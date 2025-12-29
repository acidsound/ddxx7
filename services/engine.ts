import { Patch } from '../types';
import { ALGORITHMS } from './algorithms';

const WORKLET_CODE = `
const SAMPLE_RATE = 44100;
const ALGORITHMS = ${JSON.stringify(ALGORITHMS)};

const OUTPUT_LUT = new Float32Array(4096);
for (let i = 0; i < 4096; i++) {
  const dB = (i - 3824) * 0.0235;
  OUTPUT_LUT[i] = Math.pow(20, (dB / 20));
}

const LEVEL_MAP = new Int32Array(100);
for (let i = 0; i < 100; i++) {
  LEVEL_MAP[i] = Math.floor(Math.max(0, (i * 1.27) * 32 - 224));
}

// Reference: services/engine/lfo-dx7.js tables
const LFO_PITCH_SENS_TABLE = [0, 0.0264, 0.0534, 0.0889, 0.1612, 0.2769, 0.4967, 1.0];

class LFO {
  constructor(patch) {
    this.phase = 0;
    this.randVal = 0;
    this.delayAccum = 0;
    this.patch = patch;
  }

  render(controllerModVal) {
    const { lfoSpeed, lfoDelay, lfoWaveform, lfoPitchModDepth, lfoAmpModDepth, lfoPitchModSens, lfoSync } = this.patch;
    
    // Speed approx: 0-99 -> ~0.06Hz to ~50Hz
    // Formula approx: 0.06 * (1.07 ^ speed)
    const freq = 0.06 * Math.pow(1.07, lfoSpeed);
    const phaseStep = (Math.PI * 2 * freq) / SAMPLE_RATE;
    
    this.phase += phaseStep;
    if (this.phase >= Math.PI * 2) {
      this.phase -= Math.PI * 2;
      this.randVal = (Math.random() * 2) - 1;
    }

    let raw = 0;
    switch(lfoWaveform) {
      case 0: // Triangle
        raw = (this.phase < Math.PI) ? (2 * this.phase / Math.PI) - 1 : 3 - (2 * this.phase / Math.PI);
        break;
      case 1: // Saw Down
        raw = 1 - (this.phase / Math.PI);
        break;
      case 2: // Saw Up
        raw = (this.phase / Math.PI) - 1;
        break;
      case 3: // Square
        raw = (this.phase < Math.PI) ? 1 : -1;
        break;
      case 4: // Sine
        raw = Math.sin(this.phase);
        break;
      case 5: // S/H
        raw = this.randVal;
        break;
    }

    // Delay handling (Simple linear ramp up)
    // Delay 0-99. 0 = instant, 99 = ~3-5 seconds
    let delayGain = 1.0;
    if (lfoDelay > 0) {
       const delayTimeSamples = (lfoDelay / 99) * 3 * SAMPLE_RATE;
       if (this.delayAccum < delayTimeSamples) {
         this.delayAccum++;
         delayGain = this.delayAccum / delayTimeSamples;
       }
    } else {
       this.delayAccum = 99999999;
    }

    const mod = raw * delayGain;

    // Pitch Modulation Calculation
    // P Mod Depth (0-99) + Controller (ModWheel/AT)
    // In DX7, controller adds to depth.
    const totalPDepth = (lfoPitchModDepth / 99) + controllerModVal;
    // Scale by Sensitivity (0-7)
    const pSens = LFO_PITCH_SENS_TABLE[lfoPitchModSens] || 0;
    // The modulator is exponential for pitch
    const pitchMod = 1.0 + (mod * totalPDepth * pSens * 0.05);

    // Amp Modulation Calculation (0-1 range for linear amplitude scaling)
    // A Mod Depth (0-99) + Controller
    const totalADepth = (lfoAmpModDepth / 99) + controllerModVal;
    // Operators have individual sensitivity (0-3). We return the raw mod value and apply sens in Voice.
    // Normalized mod 0..1 for easier AM math: (mod + 1) / 2
    // But DX7 LFO usually centers around 0? AM is usually unipolar reduction or bipolar tremolo?
    // Let's treat raw (-1 to 1) as modulation source.
    
    return { pitchMod, rawMod: mod, combinedADepth: totalADepth };
  }
  
  sync() {
    this.phase = 0;
    this.delayAccum = 0;
    this.randVal = 0;
  }
}

class Envelope {
  constructor(levels, rates) {
    this.levels = levels;
    this.rates = rates;
    this.level = 0;
    this.target = 0;
    this.state = 0;
    this.isCarrier = false;
    this.advance(0);
  }

  advance(s) {
    this.state = s;
    if (s < 3) {
      this.target = LEVEL_MAP[this.levels[s]];
      this.rising = this.target > this.level;
      const qr = Math.min(63, (this.rates[s] * 41) >> 6);
      this.inc = Math.pow(2, qr / 4) / 1024;
    } else if (s === 3) {
      this.target = LEVEL_MAP[this.levels[2]];
      this.level = this.target;
    } else if (s === 4) {
      this.target = LEVEL_MAP[this.levels[3]];
      this.rising = this.target > this.level;
      const qr = Math.min(63, (this.rates[3] * 41) >> 6);
      this.inc = Math.pow(2, qr / 4) / 1024;
    }
  }

  render() {
    if (this.state === 3) return OUTPUT_LUT[Math.floor(this.level)] || 0;
    if (this.state === 5) return 0;

    if (this.rising) {
      this.level += this.inc * (2 + (this.target - this.level) / 256);
      if (this.level >= this.target) { 
        this.level = this.target; 
        if (this.state < 3) this.advance(this.state + 1);
        else if (this.state === 4) this.state = 5;
      }
    } else {
      this.level -= this.inc;
      if (this.level <= this.target) { 
        this.level = this.target; 
        if (this.state < 3) this.advance(this.state + 1);
        else if (this.state === 4) this.state = 5;
      }
    }
    return OUTPUT_LUT[Math.floor(this.level)] || 0;
  }

  noteOff() {
    if (this.state < 4) this.advance(4);
  }
}

class PitchEnvelope {
  constructor(levels, rates) {
    this.levels = levels;
    this.rates = rates;
    this.level = 50 * 32;
    this.target = 0;
    this.state = 0;
    this.advance(0);
  }
  advance(s) {
    this.state = s;
    if (s < 4) {
      this.target = this.levels[s] * 32;
      const qr = Math.min(63, (this.rates[s] * 41) >> 6);
      this.inc = Math.pow(2, qr / 4) / 128;
    } else {
      this.state = 5;
    }
  }
  render() {
    if (this.state === 5) return (this.level / 32 - 50) / 50;
    if (this.state < 4) {
      const diff = this.target - this.level;
      if (Math.abs(diff) < this.inc) {
        this.level = this.target;
        this.advance(this.state + 1);
      } else {
        this.level += Math.sign(diff) * this.inc;
      }
    }
    return (this.level / 32 - 50) / 50;
  }
  noteOff() { this.advance(3); }
}

class Voice {
  constructor(note, patch, velocity, lfo) {
    this.note = note;
    this.patch = patch;
    this.lfo = lfo;
    this.velocity = Math.max(0.01, velocity);
    this.baseFreq = 440 * Math.pow(2, (note - 69 + (patch.transpose - 24)) / 12);
    this.envs = patch.operators.map(op => new Envelope(op.levels, op.rates));
    this.pitchEnv = new PitchEnvelope(patch.pitchEnvelope.levels, patch.pitchEnvelope.rates);
    
    const alg = ALGORITHMS[this.patch.algorithm - 1];
    alg.outputMix.forEach(idx => { if (this.envs[idx]) this.envs[idx].isCarrier = true; });

    this.phases = new Float32Array(6).fill(0);
    this.fbHistory = new Float32Array(2).fill(0);
    this.opOutputs = new Float32Array(6);
    this.fbConnection = this.findFeedbackConnection(alg);
    
    this.isReleased = false;
    this.isSustained = false;
    
    if (patch.oscKeySync) {
        // Phases start at 0
    } else {
        // Free running (not implemented, usually strictly 0 for FM consisteny)
    }
  }

  findFeedbackConnection(alg) {
    const hasPath = (start, end) => {
      const visited = new Set();
      const q = [start];
      while(q.length > 0) {
        const curr = q.shift();
        if (curr === end) return true;
        if (visited.has(curr)) continue;
        visited.add(curr);
        alg.modulationMatrix[curr].forEach(m => q.push(m));
      }
      return false;
    };

    for(let carrier=0; carrier<6; carrier++) {
      for(const modulator of alg.modulationMatrix[carrier]) {
        if (modulator === carrier) return { from: modulator, to: carrier };
        if (hasPath(modulator, carrier)) return { from: modulator, to: carrier };
      }
    }
    return null;
  }

  render(globalBend, lfoData) {
    const alg = ALGORITHMS[this.patch.algorithm - 1];
    const fbFactor = Math.pow(2, this.patch.feedback - 7) * 8.0;
    const pEnvMod = 1.0 + (this.pitchEnv.render() * 0.1);
    const bendMult = Math.pow(2, (globalBend * 2) / 12);
    
    // LFO Pitch Mod
    const totalPitchMod = pEnvMod * bendMult * lfoData.pitchMod;

    // LFO Amp Mod Pre-calculation
    // We need to apply AMD per operator based on sensitivity
    const { rawMod, combinedADepth } = lfoData;

    let finalL = 0, finalR = 0;

    for (let i = 5; i >= 0; i--) {
      const op = this.patch.operators[i];
      const ratio = op.oscMode === 0 
        ? (op.freqCoarse || 0.5) * (1 + op.freqFine / 100) 
        : Math.pow(10, op.freqCoarse % 4) * (1 + (op.freqFine / 99) * 8.772);
      
      const detune = Math.pow(1.0006771307, op.detune - 7);
      const step = (Math.PI * 2 * this.baseFreq * ratio * detune * totalPitchMod) / SAMPLE_RATE;

      let mod = 0;
      alg.modulationMatrix[i].forEach(m => {
        if (this.fbConnection && m === this.fbConnection.from && i === this.fbConnection.to) {
          mod += ((this.fbHistory[0] + this.fbHistory[1]) / 2) * fbFactor;
        } else {
          mod += this.opOutputs[m];
        }
      });

      const envAmp = this.envs[i].render();
      const velSens = op.velocitySens / 7;
      const vol = (op.volume / 99) * Math.pow(this.velocity, velSens);

      // Apply LFO Amp Mod
      // Sens 0 = 0, 1 = ~low, 2 = ~mid, 3 = high
      // DX7 AM is a bit complex, simplified:
      // Depth = combinedADepth (0..1+)
      // Mod = rawMod (-1..1)
      let lfoAmp = 1.0;
      if (op.lfoAmpModSens > 0) {
          const sens = op.lfoAmpModSens / 3.0; // 0.33, 0.66, 1.0
          // tremolo: 1 - depth * (1 - mod)/2  ? or (1 + mod*depth)
          // Simplified AM: reduces volume
          const amAmount = combinedADepth * sens * (0.5 * (1 + rawMod)); // Unipolar 0..1
          lfoAmp = 1.0 - (amAmount * 0.8); // Scale to not kill sound completely
      }
      
      const val = Math.sin(this.phases[i] + mod) * envAmp * vol * lfoAmp;
      this.opOutputs[i] = val;
      
      if (this.fbConnection && i === this.fbConnection.from) {
         this.fbHistory[1] = this.fbHistory[0];
         this.fbHistory[0] = val;
      }
      this.phases[i] = (this.phases[i] + step) % (Math.PI * 2);
    }

    alg.outputMix.forEach(c => {
      finalL += this.opOutputs[c];
      finalR += this.opOutputs[c];
    });

    return [finalL * 0.25, finalR * 0.25];
  }

  triggerRelease() {
      if (!this.isReleased) {
          this.isReleased = true;
          this.envs.forEach(e => e.noteOff());
          this.pitchEnv.noteOff();
      }
  }

  noteOff(sustainDown) {
    if (sustainDown) {
        this.isSustained = true;
    } else {
        this.triggerRelease();
    }
  }
  
  sustainReleased() {
      if (this.isSustained) {
          this.isSustained = false;
          this.triggerRelease();
      }
  }

  isFinished() {
    return this.envs.every(e => !e.isCarrier || e.state === 5);
  }
}

class DX7Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [];
    this.patch = null;
    this.pitchBend = 0; 
    this.modWheel = 0; 
    this.aftertouch = 0;
    this.sustain = false;
    this.lfo = null;
    
    this.port.onmessage = e => {
      const { type, data } = e.data;
      if (type === 'patch') {
          this.patch = data;
          this.lfo = new LFO(this.patch);
      }
      if (type === 'noteOn' && this.patch) {
        if (this.voices.length >= 16) this.voices.shift();
        if (this.patch.lfoSync) this.lfo?.sync();
        this.voices.push(new Voice(data.note, this.patch, data.velocity, this.lfo));
      }
      if (type === 'noteOff') {
          this.voices.forEach(v => { if (v.note === data.note) v.noteOff(this.sustain); });
      }
      if (type === 'panic') { this.voices = []; this.sustain = false; }
      if (type === 'pitchBend') this.pitchBend = data;
      if (type === 'modWheel') this.modWheel = data;
      if (type === 'aftertouch') this.aftertouch = data;
      if (type === 'sustain') {
          this.sustain = data;
          if (!this.sustain) {
              this.voices.forEach(v => v.sustainReleased());
          }
      }
    };
  }

  process(inputs, outputs) {
    const outL = outputs[0][0];
    const outR = outputs[0][1];
    if (!outL) return true;
    
    // Update LFO once per block or interpolate?
    // Block size is 128. LFO might need higher res, but 344Hz control rate (44100/128) is usually fine.
    // However, for smooth FM, we update per sample if possible, or just calculate once.
    // Let's calculate LFO state per block for efficiency, or per sample inside the loop?
    // We'll advance LFO inside the loop for sample accuracy if needed, but for JS perf, let's step it inside the loop.
    
    // Actually, LFO is shared global.
    // Calculate Controller Mod Value (ModWheel + Aftertouch)
    const ctrlMod = Math.min(1.0, this.modWheel + this.aftertouch);

    for (let i = 0; i < outL.length; i++) {
      let l = 0, r = 0;
      
      // Update LFO
      const lfoOut = this.lfo ? this.lfo.render(ctrlMod) : { pitchMod: 1, rawMod: 0, combinedADepth: 0 };
      
      this.voices = this.voices.filter(v => !v.isFinished());
      for(const v of this.voices) {
        const [vl, vr] = v.render(this.pitchBend, lfoOut);
        l += vl; r += vr;
      }
      outL[i] = l; outR[i] = r;
    }
    return true;
  }
}
registerProcessor('dx7-processor', DX7Processor);
`;

export class DX7Engine {
  private context: AudioContext;
  private node: AudioWorkletNode | null = null;
  private patchQueue: Patch | null = null;

  constructor(patch: Patch) {
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
    this.patchQueue = patch;
    this.init();
  }

  private async init() {
    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      await this.context.audioWorklet.addModule(url);
      this.node = new AudioWorkletNode(this.context, 'dx7-processor', { 
        outputChannelCount: [2],
        numberOfInputs: 0,
        numberOfOutputs: 1
      });
      this.node.connect(this.context.destination);
      if (this.patchQueue) {
        this.node.port.postMessage({ type: 'patch', data: this.patchQueue });
        this.patchQueue = null;
      }
    } catch (e) { console.error("Worklet Error", e); }
  }

  async unlock() { if (this.context.state === 'suspended') await this.context.resume(); }
  updatePatch(patch: Patch) { this.node?.port.postMessage({ type: 'patch', data: patch }); this.patchQueue = patch; }
  noteOn(note: number, velocity: number) { this.node?.port.postMessage({ type: 'noteOn', data: { note, velocity } }); }
  noteOff(note: number) { this.node?.port.postMessage({ type: 'noteOff', data: { note } }); }
  panic() { this.node?.port.postMessage({ type: 'panic' }); }
  
  setPitchBend(val: number) { this.node?.port.postMessage({ type: 'pitchBend', data: val }); }
  setModWheel(val: number) { this.node?.port.postMessage({ type: 'modWheel', data: val }); }
  setAftertouch(val: number) { this.node?.port.postMessage({ type: 'aftertouch', data: val }); }
  setSustain(val: boolean) { this.node?.port.postMessage({ type: 'sustain', data: val }); }
}