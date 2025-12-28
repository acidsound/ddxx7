
import { Patch, OperatorParams } from '../types';

const SAMPLE_RATE = 44100;
const LFO_SAMPLE_PERIOD = 100;
const OUTPUT_LUT = new Float32Array(4096);
for (let i = 0; i < 4096; i++) {
  const dB = (i - 3824) * 0.0235;
  OUTPUT_LUT[i] = Math.pow(20, (dB / 20));
}

const OUTPUT_LEVEL_TABLE = [0, 5, 9, 13, 17, 20, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 42, 43, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127];

const ALGORITHMS = [
  { outputMix: [0, 2], modulationMatrix: [[1], [], [3], [4], [5], [5]] }, { outputMix: [0, 2], modulationMatrix: [[1], [1], [3], [4], [5], []] },
  { outputMix: [0, 3], modulationMatrix: [[1], [2], [], [4], [5], [5]] }, { outputMix: [0, 3], modulationMatrix: [[1], [2], [], [4], [5], [3]] },
  { outputMix: [0, 2, 4], modulationMatrix: [[1], [], [3], [], [5], [5]] }, { outputMix: [0, 2, 4], modulationMatrix: [[1], [], [3], [], [5], [4]] },
  { outputMix: [0, 2], modulationMatrix: [[1], [], [3, 4], [], [5], [5]] }, { outputMix: [0, 2], modulationMatrix: [[1], [], [3, 4], [3], [5], []] },
  { outputMix: [0, 2], modulationMatrix: [[1], [1], [3, 4], [], [5], []] }, { outputMix: [0, 3], modulationMatrix: [[1], [2], [2], [4, 5], [], []] },
  { outputMix: [0, 3], modulationMatrix: [[1], [2], [], [4, 5], [], [5]] }, { outputMix: [0, 2], modulationMatrix: [[1], [1], [3, 4, 5], [], [], []] },
  { outputMix: [0, 2], modulationMatrix: [[1], [], [3, 4, 5], [], [], [5]] }, { outputMix: [0, 2], modulationMatrix: [[1], [], [3], [4, 5], [], [5]] },
  { outputMix: [0, 2], modulationMatrix: [[1], [1], [3], [4, 5], [], []] }, { outputMix: [0], modulationMatrix: [[1, 2, 4], [], [3], [], [5], [5]] },
  { outputMix: [0], modulationMatrix: [[1, 2, 4], [1], [3], [], [5], []] }, { outputMix: [0], modulationMatrix: [[1, 2, 3], [], [2], [4], [5], []] },
  { outputMix: [0, 3, 4], modulationMatrix: [[1], [2], [], [5], [5], [5]] }, { outputMix: [0, 1, 3], modulationMatrix: [[2], [2], [2], [4, 5], [], []] },
  { outputMix: [0, 1, 3, 4], modulationMatrix: [[2], [2], [2], [5], [5], []] }, { outputMix: [0, 2, 3, 4], modulationMatrix: [[1], [], [5], [5], [5], [5]] },
  { outputMix: [0, 1, 3, 4], modulationMatrix: [[], [2], [], [5], [5], [5]] }, { outputMix: [0, 1, 2, 3, 4], modulationMatrix: [[], [], [5], [5], [5], [5]] },
  { outputMix: [0, 1, 2, 3, 4], modulationMatrix: [[], [], [], [5], [5], [5]] }, { outputMix: [0, 1, 3], modulationMatrix: [[], [2], [], [4, 5], [], [5]] },
  { outputMix: [0, 1, 3], modulationMatrix: [[], [2], [2], [4, 5], [], []] }, { outputMix: [0, 2, 5], modulationMatrix: [[1], [], [3], [4], [4], []] },
  { outputMix: [0, 1, 2, 4], modulationMatrix: [[], [], [3], [], [5], [5]] }, { outputMix: [0, 1, 2, 5], modulationMatrix: [[], [], [3], [4], [4], []] },
  { outputMix: [0, 1, 2, 3, 4], modulationMatrix: [[], [], [], [], [5], [5]] }, { outputMix: [0, 1, 2, 3, 4, 5], modulationMatrix: [[], [], [], [], [], [5]] }
];

export class Envelope {
  level = 0; target = 0; state = 0; rising = false; decayInc = 0;
  constructor(public levels: number[], public rates: number[]) { this.advance(0); }
  render() {
    if (this.state < 4) {
      if (this.rising) {
        this.level += this.decayInc * (2 + (this.target - this.level) / 256);
        if (this.level >= this.target) { this.level = this.target; this.advance(this.state + 1); }
      } else {
        this.level -= this.decayInc;
        if (this.level <= this.target) { this.level = this.target; this.advance(this.state + 1); }
      }
    }
    return OUTPUT_LUT[Math.floor(this.level)] || 0;
  }
  advance(s: number) {
    this.state = s;
    if (s < 4) {
      this.target = Math.max(0, (OUTPUT_LEVEL_TABLE[this.levels[s]] << 5) - 224);
      this.rising = (this.target - this.level) > 0;
      this.decayInc = Math.pow(2, Math.min(63, (this.rates[s] * 41) >> 6) / 4) / 2048;
    }
  }
}

export class Operator {
  phase = 0; val = 0; phaseStep = 0;
  constructor(public params: OperatorParams, public baseFreq: number, public env: Envelope) { this.updateFreq(baseFreq); }
  updateFreq(f: number) {
    const ratio = (this.params.oscMode === 0) ? (this.params.freqCoarse || 0.5) * (1 + this.params.freqFine / 100) : Math.pow(10, this.params.freqCoarse % 4) * (1 + (this.params.freqFine / 99) * 8.772);
    this.phaseStep = (Math.PI * 2 * f * ratio * Math.pow(1.0006771307, this.params.detune - 7)) / SAMPLE_RATE;
  }
  render(mod: number) {
    this.val = Math.sin(this.phase + mod) * this.env.render();
    this.phase += this.phaseStep;
    if (this.phase >= Math.PI * 2) this.phase -= Math.PI * 2;
    return this.val;
  }
}

export class Voice {
  ops: Operator[] = [];
  finished = false;
  constructor(public note: number, public patch: Patch, public velocity: number) {
    const freq = 440 * Math.pow(2, (note - 69) / 12);
    this.ops = patch.operators.map(p => new Operator(p, freq, new Envelope(p.levels, p.rates)));
  }
  render() {
    const alg = ALGORITHMS[this.patch.algorithm - 1];
    const fbRatio = Math.pow(2, (this.patch.feedback - 7));
    let outL = 0, outR = 0;
    for (let i = 5; i >= 0; i--) {
      let mod = 0;
      alg.modulationMatrix[i].forEach(m => {
        mod += (m === i) ? this.ops[m].val * fbRatio : this.ops[m].val * (this.ops[m].params.volume / 99);
      });
      this.ops[i].render(mod);
    }
    alg.outputMix.forEach(c => {
      const vol = (this.ops[c].params.volume / 99) * (1 + (this.velocity - 1) * (this.ops[c].params.velocitySens / 7));
      outL += this.ops[c].val * vol * this.ops[c].params.ampL;
      outR += this.ops[c].val * vol * this.ops[c].params.ampR;
    });
    const scale = 1 / alg.outputMix.length;
    return [outL * scale, outR * scale];
  }
  noteOff() { this.ops.forEach(o => o.env.advance(3)); }
  isFinished() { return this.ops.every(o => o.env.state >= 4); }
}

export class SynthManager {
  voices: Voice[] = [];
  constructor(private patch: Patch) {}
  updatePatch(p: Patch) { this.patch = p; }
  noteOn(n: number, v: number) {
    if (this.voices.length > 12) this.voices.shift();
    this.voices.push(new Voice(n, this.patch, v));
  }
  noteOff(n: number) { this.voices.filter(v => v.note === n).forEach(v => v.noteOff()); }
  render() {
    let l = 0, r = 0;
    this.voices = this.voices.filter(v => !v.isFinished());
    this.voices.forEach(v => {
      const [vl, vr] = v.render();
      l += vl; r += vr;
    });
    return [l * 0.2, r * 0.2];
  }
}
