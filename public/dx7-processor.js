// Note: SAMPLE_RATE will be set from sampleRate property in process()
let SAMPLE_RATE = 44100;

// Precise DX7 Output Level Table (0-99) from dx7-synth-js
// This table maps operator level 0-99 to actual amplitude/modulation index
const OUTPUT_LEVEL_TABLE = [
    0.000000, 0.000337, 0.000476, 0.000674, 0.000952, 0.001235, 0.001602, 0.001905, 0.002265, 0.002694,
    0.003204, 0.003810, 0.004531, 0.005388, 0.006408, 0.007620, 0.008310, 0.009062, 0.010776, 0.011752,
    0.013975, 0.015240, 0.016619, 0.018123, 0.019764, 0.021552, 0.023503, 0.025630, 0.027950, 0.030480,
    0.033238, 0.036247, 0.039527, 0.043105, 0.047006, 0.051261, 0.055900, 0.060960, 0.066477, 0.072494,
    0.079055, 0.086210, 0.094012, 0.102521, 0.111800, 0.121919, 0.132954, 0.144987, 0.158110, 0.172420,
    0.188025, 0.205043, 0.223601, 0.243838, 0.265907, 0.289974, 0.316219, 0.344839, 0.376050, 0.410085,
    0.447201, 0.487676, 0.531815, 0.579948, 0.632438, 0.689679, 0.752100, 0.820171, 0.894403, 0.975353,
    1.063630, 1.159897, 1.264876, 1.379357, 1.504200, 1.640341, 1.788805, 1.950706, 2.127260, 2.319793,
    2.529752, 2.758714, 3.008399, 3.280683, 3.577610, 3.901411, 4.254519, 4.639586, 5.059505, 5.517429,
    6.016799, 6.561366, 7.155220, 7.802823, 8.509039, 9.279172, 10.11901, 11.03486, 12.03360, 13.12273
];

// Envelope level LUT for amplitude (same structure as Hexter/dx7-synth-js)
const ENV_LEVEL_TABLE = [
    0, 5, 9, 13, 17, 20, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 42, 43, 45, 46,
    48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67,
    68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87,
    88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107,
    108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127
];

// Logarithmic envelope output LUT (from dx7-synth-js: envelope-dx7.js)
// Maps internal envelope level (0-4096) to amplitude
const OUTPUT_LUT = new Float32Array(4096);
for (let i = 0; i < 4096; i++) {
    const dB = (i - 3824) * 0.0235;
    OUTPUT_LUT[i] = Math.pow(20, dB / 20); // Note: base 20, not 10
}

// Map envelope levels (0-99) to LUT indices
const LEVEL_MAP = new Int32Array(100);
for (let i = 0; i < 100; i++) {
    LEVEL_MAP[i] = Math.floor(Math.max(0, (ENV_LEVEL_TABLE[i] << 5) - 224));
}

const LFO_PITCH_SENS_TABLE = [0, 0.0264, 0.0534, 0.0889, 0.1612, 0.2769, 0.4967, 1.0];
const LFO_FREQUENCY_TABLE = [
    0.062506, 0.124815, 0.311474, 0.435381, 0.619784, 0.744396, 0.930495, 1.116390, 1.284220, 1.496880,
    1.567830, 1.738994, 1.910158, 2.081322, 2.252486, 2.423650, 2.580668, 2.737686, 2.894704, 3.051722,
    3.208740, 3.366820, 3.524900, 3.682980, 3.841060, 3.999140, 4.159420, 4.319700, 4.479980, 4.640260,
    4.800540, 4.953584, 5.106628, 5.259672, 5.412716, 5.565760, 5.724918, 5.884076, 6.043234, 6.202392,
    6.361550, 6.520044, 6.678538, 6.837032, 6.995526, 7.154020, 7.300500, 7.446980, 7.593460, 7.739940,
    7.886420, 8.020588, 8.154756, 8.288924, 8.423092, 8.557260, 8.712624, 8.867988, 9.023352, 9.178716,
    9.334080, 9.669644, 10.005208, 10.340772, 10.676336, 11.011900, 11.963680, 12.915460, 13.867240, 14.819020,
    15.770800, 16.640240, 17.509680, 18.379120, 19.248560, 20.118000, 21.040700, 21.963400, 22.886100, 23.808800,
    24.731500, 25.759740, 26.787980, 27.816220, 28.844460, 29.872700, 31.228200, 32.583700, 33.939200, 35.294700,
    36.650200, 37.812480, 38.974760, 40.137040, 41.299320, 42.461600, 43.639800, 44.818000, 45.996200, 47.174400,
    47.174400, 47.174400, 47.174400, 47.174400, 47.174400, 47.174400, 47.174400, 47.174400, 47.174400, 47.174400,
    47.174400, 47.174400, 47.174400, 47.174400, 47.174400, 47.174400, 47.174400, 47.174400, 47.174400, 47.174400,
    47.174400, 47.174400, 47.174400, 47.174400, 47.174400, 47.174400, 47.174400, 47.174400
];

class LFO {
    constructor(patch) {
        this.phase = 0;
        this.randVal = 0;
        this.counter = 0;
        this.delayVal = 0;
        this.delayState = 0; // 0=onset, 1=ramp, 2=complete
        this.patch = patch;
        this.pitchVal = 1.0;
        this.rawAmp = 0;

        // Pre-calculate delay times
        this.updateDelayTimes();
    }

    updateDelayTimes() {
        const lfoDelay = this.patch.lfoDelay;
        const lfoRate = SAMPLE_RATE / 100; // LFO updates every 100 samples (as per standard dx7-synth-js)

        // Delay times from dx7-synth-js
        this.delayOnsetTime = (lfoRate * 0.001753 * Math.pow(lfoDelay, 3.10454) + 169.344 - 168) / 1000;
        this.delayRampTime = (lfoRate * 0.321877 * Math.pow(lfoDelay, 2.01163) + 494.201 - 168) / 1000;
        this.delayRampIncrement = this.delayRampTime > this.delayOnsetTime
            ? 1 / (this.delayRampTime - this.delayOnsetTime)
            : 0;
    }

    render(controllerModVal) {
        const { lfoSpeed, lfoDelay, lfoWaveform, lfoPitchModDepth, lfoAmpModDepth, lfoPitchModSens } = this.patch;

        // Only update LFO every 100 samples (like reference implementation)
        if (this.counter % 100 === 0) {
            const freq = LFO_FREQUENCY_TABLE[lfoSpeed] || 0.062506;
            const phaseStep = (Math.PI * 2 * freq) / (SAMPLE_RATE / 100);

            // Calculate raw waveform amplitude (-1 to 1)
            let amp = 0;
            switch (lfoWaveform) {
                case 0: // Triangle
                    if (this.phase < Math.PI)
                        amp = (4 * this.phase / (Math.PI * 2)) - 1;
                    else
                        amp = 3 - (4 * this.phase / (Math.PI * 2));
                    break;
                case 1: // Saw Down
                    amp = 1 - (2 * this.phase / (Math.PI * 2));
                    break;
                case 2: // Saw Up
                    amp = (2 * this.phase / (Math.PI * 2)) - 1;
                    break;
                case 3: // Square
                    amp = (this.phase < Math.PI) ? -1 : 1;
                    break;
                case 4: // Sine
                    amp = Math.sin(this.phase);
                    break;
                case 5: // S/H
                    amp = this.randVal;
                    break;
            }

            // Handle delay state machine
            const sampleCount = this.counter / 100;
            if (this.delayState === 0) { // Onset
                if (sampleCount > this.delayOnsetTime) {
                    this.delayState = 1;
                    this.delayVal = 0;
                }
            } else if (this.delayState === 1) { // Ramp
                this.delayVal += this.delayRampIncrement;
                if (sampleCount > this.delayRampTime) {
                    this.delayState = 2;
                    this.delayVal = 1.0;
                }
            }
            // delayState 2 = complete, delayVal stays at 1.0

            // Apply delay
            amp *= (lfoDelay > 0) ? this.delayVal : 1.0;
            this.rawAmp = amp;

            // Calculate pitch modulation (from dx7-synth-js)
            // pitchModDepth = 1 + LFO_PITCH_MOD_TABLE[sens] * (controllerModVal + depth/99)
            const pSens = LFO_PITCH_SENS_TABLE[lfoPitchModSens] || 0;
            const pitchModDepth = 1 + pSens * (controllerModVal + lfoPitchModDepth / 99);
            this.pitchVal = Math.pow(pitchModDepth, amp);

            // Advance phase
            this.phase += phaseStep;
            if (this.phase >= Math.PI * 2) {
                this.phase -= Math.PI * 2;
                this.randVal = 1 - Math.random() * 2;
            }
        }

        this.counter++;

        const totalADepth = (lfoAmpModDepth / 99) + controllerModVal;
        return { pitchMod: this.pitchVal, rawMod: this.rawAmp, combinedADepth: totalADepth };
    }

    sync() {
        this.phase = 0;
        this.counter = 0;
        this.delayVal = 0;
        this.delayState = 0;
        this.randVal = 0;
        this.pitchVal = 1.0;
        this.rawAmp = 0;
    }
}

class Envelope {
    constructor(levels, rates, note, keyScaleRate) {
        this.levels = levels;
        this.rates = rates;
        this.level = 0;
        this.targetlevel = 0;
        this.state = 0;
        this.isCarrier = false;
        this.down = true; // Key is held down
        this.decayIncrement = 0;
        this.rising = false;

        // Note: Reference envelope-dx7.js does NOT apply keyboard rate scaling
        // It uses rate_scaling = 0 always. Keeping note for potential future use.
        this.note = note;
        this.keyScaleRate = keyScaleRate;

        this.advance(0);
    }

    advance(newstate) {
        this.state = newstate;
        if (this.state < 4) {
            const newlevel = this.levels[this.state];
            // Target level: Map 0-99 to internal scale (0-3840 approx)
            this.targetlevel = Math.max(0, (ENV_LEVEL_TABLE[newlevel] << 5) - 224);
            this.rising = (this.targetlevel - this.level) > 0;

            // Apply Keyboard Rate Scaling (RS)
            // DX7: Rate increases as you play higher notes based on keyScaleRate
            const noteOffset = Math.max(0, this.note - 21); // A-1 corresponds to 0
            const rBoost = Math.floor(this.keyScaleRate * noteOffset / 8);
            const effectiveRate = Math.min(99, this.rates[this.state] + rBoost);

            // Rate calculation using effectiveRate
            const qr = Math.min(63, (effectiveRate * 41) >> 6);
            // Adjusted divisor: 8192 to significantly slow down decay (4x reference 2048)
            const divisor = 8192 * (SAMPLE_RATE / 44100);
            this.decayIncrement = Math.pow(2, qr / 4) / divisor;
        }
    }

    render() {
        // Key condition from reference: process if state < 3, OR if state < 4 AND key released
        if (this.state < 3 || (this.state < 4 && !this.down)) {
            if (this.rising) {
                this.level += this.decayIncrement * (2 + (this.targetlevel - this.level) / 256);
                if (this.level >= this.targetlevel) {
                    this.level = this.targetlevel;
                    this.advance(this.state + 1);
                }
            } else {
                this.level -= this.decayIncrement;
                if (this.level <= this.targetlevel) {
                    this.level = this.targetlevel;
                    this.advance(this.state + 1);
                }
            }
        }

        // Clamp level to valid range and convert to amplitude via LUT
        const idx = Math.max(0, Math.min(4095, Math.floor(this.level)));
        return OUTPUT_LUT[idx];
    }

    noteOff() {
        this.down = false;
        this.advance(3); // Advance to release state (state 3)
    }

    isFinished() {
        return this.state >= 4;
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
    constructor(note, patch, velocity, lfo, algorithmData) {
        this.note = note;
        this.patch = patch;
        this.lfo = lfo;
        this.alg = algorithmData;
        this.velocity = velocity; // 0 to 1
        // Pitch Check: Reverting +24 boost as user reports sound is 2 octaves too high
        const transpose = (typeof patch.transpose === 'number') ? patch.transpose : 24;
        this.baseFreq = 440 * Math.pow(2, (note - 69 + (transpose - 24)) / 12);

        // Calculate Final Operator Volumes using the precise OUTPUT_LEVEL_TABLE
        this.opVolumes = new Float32Array(6);
        this.envs = patch.operators.map((op, i) => {
            // Use the dx7-synth-js output level table directly
            // Velocity sensitivity: (1 + (velocity - 1) * (velSens / 7))
            const velFactor = (1 + (velocity - 1) * (op.velocitySens / 7));
            const levelIdx = Math.max(0, Math.min(99, op.volume));
            this.opVolumes[i] = OUTPUT_LEVEL_TABLE[levelIdx] * velFactor;

            return new Envelope(op.levels, op.rates, note, op.keyScaleRate);
        });

        this.pitchEnv = new PitchEnvelope(patch.pitchEnvelope.levels, patch.pitchEnvelope.rates);
        this.alg.outputMix.forEach(idx => { if (this.envs[idx]) this.envs[idx].isCarrier = true; });

        this.phases = new Float32Array(6).fill(0);
        this.fbHistory = new Float32Array(2).fill(0);
        this.opOutputs = new Float32Array(6);
        this.fbConnection = this.findFeedbackConnection();

        this.isReleased = false;
        this.isSustained = false;
    }

    findFeedbackConnection() {
        const hasPath = (start, end) => {
            const visited = new Set();
            const q = [start];
            while (q.length > 0) {
                const curr = q.shift();
                if (curr === end) return true;
                if (visited.has(curr)) continue;
                visited.add(curr);
                this.alg.modulationMatrix[curr].forEach(m => q.push(m));
            }
            return false;
        };

        for (let carrier = 0; carrier < 6; carrier++) {
            for (const modulator of this.alg.modulationMatrix[carrier]) {
                if (modulator === carrier) return { from: modulator, to: carrier };
                if (hasPath(modulator, carrier)) return { from: modulator, to: carrier };
            }
        }
        return null;
    }

    render(globalBend, lfoData) {
        // Feedback ratio from dx7-synth-js: Math.pow(2, (fb - 7)) where fb=0-7
        const fbFactor = Math.pow(2, this.patch.feedback - 7);
        const pEnvMod = 1.0 + (this.pitchEnv.render() * 0.1);
        const bendMult = Math.pow(2, (globalBend * 2) / 12);

        const totalPitchMod = pEnvMod * bendMult * lfoData.pitchMod;
        const { rawMod, combinedADepth } = lfoData;

        let finalL = 0, finalR = 0;

        for (let i = 5; i >= 0; i--) {
            const op = this.patch.operators[i];

            // Calculate frequency based on oscMode
            let frequency;
            if (op.oscMode === 0) {
                // Ratio mode: frequency = baseFreq * ratio
                const freqRatio = (op.freqCoarse || 0.5) * (1 + op.freqFine / 100);
                const detune = Math.pow(1.0006771307, op.detune - 7);
                frequency = this.baseFreq * freqRatio * detune * totalPitchMod;
            } else {
                // Fixed mode: frequency in Hz (not affected by note pitch)
                // Formula from dx7-synth-js: pow(10, coarse % 4) * (1 + (fine / 99) * 8.772)
                const freqFixed = Math.pow(10, op.freqCoarse % 4) * (1 + (op.freqFine / 99) * 8.772);
                const detune = Math.pow(1.0006771307, op.detune - 7);
                frequency = freqFixed * detune; // Note: no baseFreq, no totalPitchMod for fixed
            }

            const step = (Math.PI * 2 * frequency) / SAMPLE_RATE;

            let mod = 0;
            this.alg.modulationMatrix[i].forEach(m => {
                if (this.fbConnection && m === this.fbConnection.from && i === this.fbConnection.to) {
                    mod += ((this.fbHistory[0] + this.fbHistory[1]) / 2) * fbFactor;
                } else {
                    mod += this.opOutputs[m];
                }
            });

            const envAmp = this.envs[i].render();
            const vol = this.opVolumes[i];

            let lfoAmp = 1.0;
            if (op.lfoAmpModSens > 0) {
                const sens = op.lfoAmpModSens / 3.0;
                const amAmount = combinedADepth * sens * (0.5 * (1 + rawMod));
                lfoAmp = 1.0 - (amAmount * 0.8);
            }

            const val = Math.sin(this.phases[i] + mod) * envAmp * vol * lfoAmp;
            this.opOutputs[i] = val;

            if (this.fbConnection && i === this.fbConnection.from) {
                this.fbHistory[1] = this.fbHistory[0];
                this.fbHistory[0] = val;
            }
            this.phases[i] = (this.phases[i] + step) % (Math.PI * 2);
        }

        this.alg.outputMix.forEach(c => {
            finalL += this.opOutputs[c];
            finalR += this.opOutputs[c];
        });

        // Per-voice level from dx7-synth-js: 0.125 / 6 (nominal per-voice level)
        // Reference doesn't scale by carrier count - the output level table already handles that
        const perVoiceLevel = 0.125 / 6;
        return [finalL * perVoiceLevel, finalR * perVoiceLevel];
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
        // Check if all carrier envelopes are finished
        return this.envs.every(e => !e.isCarrier || e.isFinished());
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
        this.algorithms = null; // Received via message
        this.counter = 0; // For metering timing
        this.heldNotes = []; // Stack for Mono mode note priority

        this.port.onmessage = e => {
            const { type, data, algorithms } = e.data;
            if (type === 'init') {
                this.algorithms = algorithms;
            }
            if (type === 'patch') {
                this.patch = data;
                this.lfo = new LFO(this.patch);
                this.heldNotes = [];
                this.voices = []; // Clear active voices on patch change
            }
            if (type === 'noteOn' && this.patch && this.algorithms) {
                const algData = this.algorithms[this.patch.algorithm - 1];
                if (algData) {
                    if (this.patch.mono) {
                        // Mono Mode: Note Stack Logic (Last Note Priority with Retrigger)
                        this.heldNotes = this.heldNotes.filter(n => n.note !== data.note);
                        this.heldNotes.push({ note: data.note, velocity: data.velocity });

                        this.voices = []; // Retrigger hard
                        this.voices.push(new Voice(data.note, this.patch, data.velocity, this.lfo, algData));
                    } else {
                        // Poly Mode
                        if (this.voices.length >= 16) this.voices.shift();
                        if (this.patch.lfoSync) this.lfo?.sync();
                        this.voices.push(new Voice(data.note, this.patch, data.velocity, this.lfo, algData));
                    }
                }
            }
            if (type === 'noteOff') {
                if (this.patch && this.patch.mono) {
                    // Mono Mode: Remove from stack & Retrigger previous
                    const prevTop = this.heldNotes.length > 0 ? this.heldNotes[this.heldNotes.length - 1] : null;
                    this.heldNotes = this.heldNotes.filter(n => n.note !== data.note);
                    const newTop = this.heldNotes.length > 0 ? this.heldNotes[this.heldNotes.length - 1] : null;

                    if (prevTop && prevTop.note === data.note) {
                        // We released the currently playing note
                        if (newTop) {
                            // Retrigger previous note
                            this.voices = [];
                            const algData = this.algorithms[this.patch.algorithm - 1];
                            if (algData) {
                                this.voices.push(new Voice(newTop.note, this.patch, newTop.velocity, this.lfo, algData));
                            }
                        } else {
                            // No notes left, release current voice
                            this.voices.forEach(v => v.noteOff(this.sustain));
                        }
                    }
                } else {
                    // Poly Mode
                    this.voices.forEach(v => { if (v.note === data.note) v.noteOff(this.sustain); });
                }
            }
            if (type === 'panic') { this.voices = []; this.heldNotes = []; this.sustain = false; }
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
        if (!this.algorithms || !this.patch) return true; // Wait for initialization

        // Update global SAMPLE_RATE from AudioWorkletProcessor
        if (SAMPLE_RATE !== sampleRate) {
            SAMPLE_RATE = sampleRate;
            console.log('DX7 Processor running at', SAMPLE_RATE, 'Hz');
        }

        const atEffect = this.patch.aftertouchEnabled ? this.aftertouch : 0;
        const ctrlMod = Math.min(1.27, this.modWheel + atEffect);

        for (let i = 0; i < outL.length; i++) {
            let l = 0, r = 0;

            const lfoOut = this.lfo ? this.lfo.render(ctrlMod) : { pitchMod: 1, rawMod: 0, combinedADepth: 0 };

            this.voices = this.voices.filter(v => !v.isFinished());
            for (const v of this.voices) {
                const [vl, vr] = v.render(this.pitchBend, lfoOut);
                l += vl; r += vr;
            }
            outL[i] = l; outR[i] = r;
        }

        // Metering: Send operator levels and envelope states every ~46ms (2048 samples)
        if (this.counter % 2048 === 0) {
            const levels = new Float32Array(6);
            const states = new Int8Array(6).fill(4); // Default to finished/off

            if (this.voices.length > 0) {
                // Use the latest voice for visualization
                const latestVoice = this.voices[this.voices.length - 1];
                for (let op = 0; op < 6; op++) {
                    levels[op] = Math.abs(latestVoice.opOutputs[op]);
                    states[op] = latestVoice.envs[op].state;
                }
            }
            this.port.postMessage({ type: 'opLevels', data: levels, envStates: states });
        }
        this.counter += outL.length;

        return true;
    }
}

registerProcessor('dx7-processor', DX7Processor);
