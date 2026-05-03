// Note: SAMPLE_RATE will be set from sampleRate property in process()
let SAMPLE_RATE = 44100;
let TWO_PI_OVER_SAMPLE_RATE = (Math.PI * 2) / SAMPLE_RATE;

const TWO_PI = Math.PI * 2;
const INV_TWO_PI = 1 / TWO_PI;
const SIN_LUT_SIZE = 4096;
const SIN_LUT_MASK = SIN_LUT_SIZE - 1;
const SIN_LUT_SCALE = SIN_LUT_SIZE / TWO_PI;
const SIN_LUT = new Float32Array(SIN_LUT_SIZE);
for (let i = 0; i < SIN_LUT_SIZE; i++) {
    SIN_LUT[i] = Math.sin((i / SIN_LUT_SIZE) * TWO_PI);
}

const POW2_QR_TABLE = new Float32Array(64);
for (let i = 0; i < POW2_QR_TABLE.length; i++) {
    POW2_QR_TABLE[i] = Math.pow(2, i / 4);
}

const FEEDBACK_FACTOR_TABLE = new Float32Array(8);
for (let i = 0; i < FEEDBACK_FACTOR_TABLE.length; i++) {
    FEEDBACK_FACTOR_TABLE[i] = Math.pow(2, i - 7);
}

const DETUNE_TABLE = new Float32Array(15);
for (let i = 0; i < DETUNE_TABLE.length; i++) {
    DETUNE_TABLE[i] = Math.pow(1.0006771307, i - 7);
}

const FIXED_COARSE_TABLE = new Float32Array([1, 10, 100, 1000]);

function setProcessorSampleRate(nextSampleRate) {
    SAMPLE_RATE = nextSampleRate;
    TWO_PI_OVER_SAMPLE_RATE = TWO_PI / SAMPLE_RATE;
}

function wrapPhase(phase) {
    phase -= Math.floor(phase * INV_TWO_PI) * TWO_PI;
    return phase < 0 ? phase + TWO_PI : phase;
}

function fastSin(phase) {
    phase = wrapPhase(phase);
    const scaled = phase * SIN_LUT_SCALE;
    const idx = scaled | 0;
    const frac = scaled - idx;
    const a = SIN_LUT[idx];
    return a + (SIN_LUT[(idx + 1) & SIN_LUT_MASK] - a) * frac;
}

function fastTanh(x) {
    if (x <= -3) return -1;
    if (x >= 3) return 1;
    const x2 = x * x;
    return x * (27 + x2) / (27 + 9 * x2);
}

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

const PER_VOICE_LEVEL = 0.125 / 6;
const SOFT_LIMIT_THRESHOLD = 0.98;

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
        this.pitchMod = 1.0;
        this.rawAmp = 0;
        this.combinedADepth = 0;

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
            const phaseStep = (TWO_PI * freq * 100) / SAMPLE_RATE;

            // Calculate raw waveform amplitude (-1 to 1)
            let amp = 0;
            switch (lfoWaveform) {
                case 0: // Triangle
                    if (this.phase < Math.PI)
                        amp = (4 * this.phase / TWO_PI) - 1;
                    else
                        amp = 3 - (4 * this.phase / TWO_PI);
                    break;
                case 1: // Saw Down
                    amp = 1 - (2 * this.phase / TWO_PI);
                    break;
                case 2: // Saw Up
                    amp = (2 * this.phase / TWO_PI) - 1;
                    break;
                case 3: // Square
                    amp = (this.phase < Math.PI) ? -1 : 1;
                    break;
                case 4: // Sine
                    amp = fastSin(this.phase);
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
            this.pitchMod = this.pitchVal;

            // Advance phase
            this.phase += phaseStep;
            if (this.phase >= TWO_PI) {
                this.phase = wrapPhase(this.phase);
                this.randVal = 1 - Math.random() * 2;
            }
        }

        this.counter++;

        this.combinedADepth = (lfoAmpModDepth / 99) + controllerModVal;
        return this;
    }

    sync() {
        this.phase = 0;
        this.counter = 0;
        this.delayVal = 0;
        this.delayState = 0;
        this.randVal = 0;
        this.pitchVal = 1.0;
        this.pitchMod = 1.0;
        this.rawAmp = 0;
        this.combinedADepth = 0;
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

            // Match dx7-synth-js envelope reference behavior: no keyboard rate scaling boost.
            const effectiveRate = this.rates[this.state];

            // Rate calculation using effectiveRate
            const qr = Math.min(63, (effectiveRate * 41) >> 6);
            // dx7-synth-js reference divisor
            const divisor = 2048 * (SAMPLE_RATE / 44100);
            this.decayIncrement = POW2_QR_TABLE[qr] / divisor;
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
        let idx = this.level | 0;
        if (idx < 0) idx = 0;
        else if (idx > 4095) idx = 4095;
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
            this.inc = POW2_QR_TABLE[qr] / 128;
        } else {
            this.state = 5;
        }
    }
    render() {
        if (this.state === 5) return (this.level / 32 - 50) / 50;
        if (this.state < 4) {
            const diff = this.target - this.level;
            if (diff < this.inc && diff > -this.inc) {
                this.level = this.target;
                this.advance(this.state + 1);
            } else {
                this.level += diff > 0 ? this.inc : -this.inc;
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
        this.modulationMatrix = algorithmData.modulationMatrix;
        this.outputMix = algorithmData.outputMix;
        this.velocity = velocity; // 0 to 1
        // Pitch Check: Reverting +24 boost as user reports sound is 2 octaves too high
        const transpose = (typeof patch.transpose === 'number') ? patch.transpose : 24;
        this.baseFreq = 440 * Math.pow(2, (note - 69 + (transpose - 24)) / 12);

        this.opVolumes = new Float32Array(6);
        this.opStepBase = new Float32Array(6);
        this.opPitchAffected = new Int8Array(6);
        this.opAmpModSens = new Float32Array(6);
        this.envs = new Array(6);
        for (let i = 0; i < 6; i++) {
            const op = patch.operators[i];
            const velFactor = (1 + (velocity - 1) * (op.velocitySens / 7));
            const levelIdx = Math.max(0, Math.min(99, op.volume));
            this.opVolumes[i] = OUTPUT_LEVEL_TABLE[levelIdx] * velFactor;
            this.opAmpModSens[i] = op.lfoAmpModSens > 0 ? op.lfoAmpModSens / 3.0 : 0;
            this.envs[i] = new Envelope(op.levels, op.rates, note, op.keyScaleRate);

            const detune = DETUNE_TABLE[Math.max(0, Math.min(14, op.detune | 0))];
            if (op.oscMode === 0) {
                const freqRatio = (op.freqCoarse || 0.5) * (1 + op.freqFine / 100);
                this.opStepBase[i] = this.baseFreq * freqRatio * detune * TWO_PI_OVER_SAMPLE_RATE;
                this.opPitchAffected[i] = 1;
            } else {
                const freqFixed = FIXED_COARSE_TABLE[(op.freqCoarse | 0) & 3] * (1 + (op.freqFine / 99) * 8.772);
                this.opStepBase[i] = freqFixed * detune * TWO_PI_OVER_SAMPLE_RATE;
                this.opPitchAffected[i] = 0;
            }
        }

        this.pitchEnv = new PitchEnvelope(patch.pitchEnvelope.levels, patch.pitchEnvelope.rates);
        for (let i = 0; i < this.outputMix.length; i++) {
            const idx = this.outputMix[i];
            if (this.envs[idx]) this.envs[idx].isCarrier = true;
        }

        this.phases = new Float32Array(6);
        this.fbHistory = new Float32Array(2);
        this.opOutputs = new Float32Array(6);
        this.fbConnection = this.findFeedbackConnection();
        const feedback = Math.max(0, Math.min(7, patch.feedback | 0));
        this.fbFactor = FEEDBACK_FACTOR_TABLE[feedback];
        const masterLevel = Math.max(0, Math.min(99, Number(patch.masterLevel ?? 80))) / 99;
        const outputScaling = 1 / Math.max(1, this.outputMix.length);
        this.perVoiceLevel = PER_VOICE_LEVEL * outputScaling * masterLevel;

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
                const mods = this.modulationMatrix[curr];
                for (let i = 0; i < mods.length; i++) q.push(mods[i]);
            }
            return false;
        };

        for (let carrier = 0; carrier < 6; carrier++) {
            const mods = this.modulationMatrix[carrier];
            for (let i = 0; i < mods.length; i++) {
                const modulator = mods[i];
                if (modulator === carrier) return { from: modulator, to: carrier };
                if (hasPath(modulator, carrier)) return { from: modulator, to: carrier };
            }
        }
        return null;
    }

    render(bendMult, lfoData) {
        const pEnvMod = 1.0 + (this.pitchEnv.render() * 0.1);
        const pitchMod = lfoData.pitchMod ?? lfoData.pitchVal ?? 1.0;
        const totalPitchMod = pEnvMod * bendMult * pitchMod;
        const rawMod = lfoData.rawAmp;
        const combinedADepth = lfoData.combinedADepth;

        for (let i = 5; i >= 0; i--) {
            const step = this.opPitchAffected[i] ? this.opStepBase[i] * totalPitchMod : this.opStepBase[i];

            let mod = 0;
            const mods = this.modulationMatrix[i];
            for (let modIdx = 0; modIdx < mods.length; modIdx++) {
                const m = mods[modIdx];
                if (this.fbConnection && m === this.fbConnection.from && i === this.fbConnection.to) {
                    mod += ((this.fbHistory[0] + this.fbHistory[1]) * 0.5) * this.fbFactor;
                } else {
                    mod += this.opOutputs[m];
                }
            }

            const envAmp = this.envs[i].render();
            const vol = this.opVolumes[i];

            let lfoAmp = 1.0;
            const ampSens = this.opAmpModSens[i];
            if (ampSens > 0) {
                const amAmount = combinedADepth * ampSens * (0.5 * (1 + rawMod));
                lfoAmp = 1.0 - (amAmount * 0.8);
            }

            const val = fastSin(this.phases[i] + mod) * envAmp * vol * lfoAmp;
            this.opOutputs[i] = val;

            if (this.fbConnection && i === this.fbConnection.from) {
                this.fbHistory[1] = this.fbHistory[0];
                this.fbHistory[0] = val;
            }
            let phase = this.phases[i] + step;
            if (phase >= TWO_PI) phase = wrapPhase(phase);
            this.phases[i] = phase;
        }

        let output = 0;
        for (let i = 0; i < this.outputMix.length; i++) {
            output += this.opOutputs[this.outputMix[i]];
        }

        // Normalize by carrier count so multi-carrier algorithms do not get disproportionately louder,
        // then apply the user-visible master level control before the final bus mix.
        return output * this.perVoiceLevel;
    }

    triggerRelease() {
        if (!this.isReleased) {
            this.isReleased = true;
            for (let i = 0; i < this.envs.length; i++) this.envs[i].noteOff();
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
        for (let i = 0; i < this.envs.length; i++) {
            const env = this.envs[i];
            if (env.isCarrier && !env.isFinished()) return false;
        }
        return true;
    }
}

class OnePoleLowPass {
    constructor(sampleRate, cutoffHz) {
        this.sampleRate = sampleRate;
        this.z = 0;
        this.a = 0;
        this.setCutoff(cutoffHz);
    }

    setSampleRate(sampleRate) {
        this.sampleRate = sampleRate;
    }

    setCutoff(cutoffHz) {
        const nyquist = this.sampleRate * 0.5;
        const hz = Math.max(20, Math.min(nyquist * 0.45, cutoffHz));
        this.a = 1 - Math.exp((-2 * Math.PI * hz) / this.sampleRate);
    }

    process(input) {
        this.z += this.a * (input - this.z);
        return this.z;
    }

    reset() {
        this.z = 0;
    }
}

class DcBlocker {
    constructor(coefficient = 0.995) {
        this.r = coefficient;
        this.x1 = 0;
        this.y1 = 0;
    }

    process(input) {
        const y = input - this.x1 + this.r * this.y1;
        this.x1 = input;
        this.y1 = y;
        return y;
    }

    reset() {
        this.x1 = 0;
        this.y1 = 0;
    }
}

class MonotronDelay {
    constructor(sampleRate) {
        this.sampleRate = sampleRate;
        this.delayTime = 45;
        this.delayFeedback = 0;
        this.currentDelaySamples = this.delayMsForKnob(this.delayTime) * this.sampleRate / 1000;
        this.targetDelaySamples = this.currentDelaySamples;
        this.writeIndex = 0;
        this.feedbackSample = 0;
        this.noiseSeed = 0x12345678;
        this.jitter = 0;
        this.jitterTarget = 0;
        this.controlCounter = 0;
        this.active = false;
        this.outputL = 0;
        this.outputR = 0;
        this.allocateBuffer();

        this.inputHp = new DcBlocker(0.995);
        this.outputHp = new DcBlocker(0.998);
        this.preLp = new OnePoleLowPass(sampleRate, 5200);
        this.postLpA = new OnePoleLowPass(sampleRate, 4200);
        this.postLpB = new OnePoleLowPass(sampleRate, 3200);
        this.feedbackLp = new OnePoleLowPass(sampleRate, 2600);
        this.updateDerivedParams();
    }

    allocateBuffer() {
        this.maxDelaySamples = Math.ceil(this.sampleRate * 1.25) + 8;
        this.buffer = new Float32Array(this.maxDelaySamples);
        this.writeIndex = Math.min(this.writeIndex, this.maxDelaySamples - 1);
    }

    setSampleRate(sampleRate) {
        if (this.sampleRate === sampleRate) return;
        this.sampleRate = sampleRate;
        this.allocateBuffer();
        this.currentDelaySamples = this.delayMsForKnob(this.delayTime) * this.sampleRate / 1000;
        this.targetDelaySamples = this.currentDelaySamples;
        this.preLp.setSampleRate(sampleRate);
        this.postLpA.setSampleRate(sampleRate);
        this.postLpB.setSampleRate(sampleRate);
        this.feedbackLp.setSampleRate(sampleRate);
        this.updateDerivedParams();
    }

    setParams(params) {
        if (!params) return;
        const previousFeedback = this.delayFeedback;
        this.delayTime = Math.max(0, Math.min(99, Number(params.delayTime ?? this.delayTime)));
        this.delayFeedback = Math.max(0, Math.min(99, Number(params.delayFeedback ?? this.delayFeedback)));
        this.targetDelaySamples = this.delayMsForKnob(this.delayTime) * this.sampleRate / 1000;
        if (previousFeedback > 0 && this.delayFeedback <= 0) {
            this.reset();
        }
        this.updateDerivedParams();
    }

    delayMsForKnob(value) {
        const x = Math.max(0, Math.min(1, value / 99));
        const resistanceK = 0.5 + Math.pow(x, 2.1) * 100.5;
        const table = [
            [0.5, 31.3], [0.723, 36.6], [1.08, 40.6], [1.28, 43.0],
            [1.47, 45.8], [1.67, 48.1], [2.0, 52.3], [2.4, 56.6],
            [2.8, 61.6], [3.4, 68.1], [4.0, 75.9], [4.5, 81.0],
            [4.9, 86.3], [5.4, 92.2], [5.8, 97.1], [6.4, 104.3],
            [7.2, 113.7], [8.2, 124.1], [9.2, 136.6], [10.5, 151.0],
            [12.1, 171.0], [14.3, 196.0], [17.2, 228.0], [21.3, 273.0],
            [27.6, 342.0]
        ];

        if (resistanceK <= table[0][0]) return table[0][1];
        for (let i = 1; i < table.length; i++) {
            const [r0, t0] = table[i - 1];
            const [r1, t1] = table[i];
            if (resistanceK <= r1) {
                const mix = (resistanceK - r0) / (r1 - r0);
                return t0 + (t1 - t0) * mix;
            }
        }

        const extended = (resistanceK - 27.6) / (101 - 27.6);
        return 342 + Math.pow(Math.max(0, Math.min(1, extended)), 0.78) * 608;
    }

    updateDerivedParams() {
        const delayMs = this.targetDelaySamples * 1000 / this.sampleRate;
        const normTime = Math.max(0, Math.min(1, (delayMs - 31.3) / (950 - 31.3)));
        const amount = Math.max(0, Math.min(1, this.delayFeedback / 99));

        this.amount = amount;
        this.active = amount > 0.0001;
        this.feedbackGain = amount * (0.54 + 0.64 * amount);
        this.wetMix = amount * (0.12 + 0.5 * amount);
        this.inputDrive = 1.15 + amount * 0.95;
        this.noiseGain = amount * (0.000015 + normTime * normTime * 0.0012);
        this.jitterDepth = amount * (0.15 + normTime * 5.5);
        this.quantScale = Math.pow(2, 14 - normTime * 4.5);

        this.preLp.setCutoff(6200 - normTime * 3500);
        this.postLpA.setCutoff(5200 - normTime * 4000);
        this.postLpB.setCutoff(3600 - normTime * 2450);
        this.feedbackLp.setCutoff(3100 - normTime * 2150);
    }

    nextNoise() {
        this.noiseSeed = (1664525 * this.noiseSeed + 1013904223) >>> 0;
        return (this.noiseSeed / 0x80000000) - 1;
    }

    readDelay(delaySamples) {
        let readPos = this.writeIndex - delaySamples;
        while (readPos < 0) readPos += this.maxDelaySamples;
        const baseIndex = Math.floor(readPos);
        const i0 = baseIndex % this.maxDelaySamples;
        const i1 = (i0 + 1) % this.maxDelaySamples;
        const frac = readPos - baseIndex;
        return this.buffer[i0] + (this.buffer[i1] - this.buffer[i0]) * frac;
    }

    softClip(input, drive) {
        return fastTanh(input * drive) / drive;
    }

    reset() {
        this.buffer.fill(0);
        this.writeIndex = 0;
        this.feedbackSample = 0;
        this.inputHp.reset();
        this.outputHp.reset();
        this.preLp.reset();
        this.postLpA.reset();
        this.postLpB.reset();
        this.feedbackLp.reset();
    }

    render(left, right) {
        const mono = (left + right) * 0.5;

        if (!this.active) {
            this.feedbackSample = 0;
            this.buffer[this.writeIndex] = 0;
            this.writeIndex = (this.writeIndex + 1) % this.maxDelaySamples;
            this.outputL = left;
            this.outputR = right;
            return;
        }

        this.controlCounter += 1;
        if ((this.controlCounter & 511) === 0) {
            this.jitterTarget = this.nextNoise() * this.jitterDepth;
        }

        this.currentDelaySamples += (this.targetDelaySamples - this.currentDelaySamples) * 0.0009;
        this.jitter += (this.jitterTarget - this.jitter) * 0.00012;

        const delayedRaw = this.readDelay(
            Math.max(1, Math.min(this.maxDelaySamples - 4, this.currentDelaySamples + this.jitter))
        );

        const noise = this.nextNoise() * this.noiseGain;
        let delayReturn = this.postLpA.process(delayedRaw + noise);
        delayReturn = this.postLpB.process(delayReturn);
        delayReturn = this.outputHp.process(delayReturn);
        delayReturn = this.softClip(delayReturn, 1.65);

        const feedback = this.feedbackLp.process(this.feedbackSample) * this.feedbackGain;
        let writeSample = this.inputHp.process(mono) + feedback;
        writeSample = this.preLp.process(this.softClip(writeSample, this.inputDrive));
        writeSample = Math.round(writeSample * this.quantScale) / this.quantScale;
        this.buffer[this.writeIndex] = this.softClip(writeSample, 1.35);
        this.writeIndex = (this.writeIndex + 1) % this.maxDelaySamples;

        this.feedbackSample = delayReturn;
        const wet = this.softClip(delayReturn * this.wetMix, 1.4);
        this.outputL = left + wet;
        this.outputR = right + wet;
    }
}

class DX7Processor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.voices = [];
        this.patch = null;
        this.globalFx = { delayTime: 45, delayFeedback: 0 };
        this.monotronDelay = new MonotronDelay(SAMPLE_RATE);
        this.pitchBend = 0;
        this.pitchBendMultiplier = 1;
        this.modWheel = 0;
        this.aftertouch = 0;
        this.sustain = false;
        this.lfo = null;
        this.neutralLfo = { pitchMod: 1, rawAmp: 0, combinedADepth: 0 };
        this.algorithms = null; // Received via message
        this.counter = 0; // For metering timing
        this.heldNotes = []; // Stack for Mono mode note priority
        this.scheduledEvents = []; // [{ frame, type, data }]
        this.scheduledEventIndex = 0;
        this.globalFrame = 0;
        this.meterLevels = new Float32Array(6);
        this.meterStates = new Int8Array(6);
        this.meterPeaks = new Float32Array(6);

        this.port.onmessage = e => {
            const { type, data, algorithms } = e.data;
            if (type === 'init') {
                this.algorithms = algorithms;
                return;
            }
            if (type === 'scheduleEvents') {
                this.resetForScheduledPlayback();
                if (Array.isArray(data)) {
                    this.scheduledEvents = data
                        .map(ev => ({
                            frame: Math.max(0, Number(ev.frame) || 0),
                            type: ev.type,
                            data: ev.data || {}
                        }))
                        .sort((a, b) => a.frame - b.frame);
                } else {
                    this.scheduledEvents = [];
                }
                return;
            }
            if (type === 'globalFx') {
                this.globalFx = {
                    delayTime: Math.max(0, Math.min(99, Number(data?.delayTime ?? this.globalFx.delayTime))),
                    delayFeedback: Math.max(0, Math.min(99, Number(data?.delayFeedback ?? this.globalFx.delayFeedback)))
                };
                this.monotronDelay.setParams(this.globalFx);
                return;
            }
            this.handleIncomingEvent(type, data);
        };
    }

    resetForScheduledPlayback() {
        this.voices = [];
        this.heldNotes = [];
        this.sustain = false;
        this.pitchBend = 0;
        this.pitchBendMultiplier = 1;
        this.modWheel = 0;
        this.aftertouch = 0;
        this.counter = 0;
        this.globalFrame = 0;
        this.scheduledEvents = [];
        this.scheduledEventIndex = 0;
        this.monotronDelay.reset();
    }

    handleIncomingEvent(type, data) {
        if (type === 'patch') {
            const nextPatch = data && data.patch ? data.patch : data;
            const resetVoices = !(data && data.patch && data.resetVoices === false);
            this.patch = nextPatch;
            this.lfo = new LFO(this.patch);
            if (resetVoices) {
                this.heldNotes = [];
                this.voices = [];
            }
            this.scheduledEvents = [];
            this.scheduledEventIndex = 0;
            this.globalFrame = 0;
            this.counter = 0;
            return;
        }

        if (type === 'panic') {
            this.voices = [];
            this.heldNotes = [];
            this.sustain = false;
            this.pitchBend = 0;
            this.pitchBendMultiplier = 1;
            return;
        }

        if (type === 'pitchBend') {
            this.pitchBend = Number(data) || 0;
            this.pitchBendMultiplier = Math.pow(2, (this.pitchBend * 2) / 12);
            return;
        }
        if (type === 'modWheel') {
            this.modWheel = Number(data) || 0;
            return;
        }
        if (type === 'aftertouch') {
            this.aftertouch = Number(data) || 0;
            return;
        }
        if (type === 'sustain') {
            this.sustain = !!data;
            if (!this.sustain) {
                this.voices.forEach(v => v.sustainReleased());
            }
            return;
        }

        if (!this.patch || !this.algorithms) return;
        const algData = this.algorithms[this.patch.algorithm - 1];
        if (!algData) return;

        if (type === 'noteOn') {
            const note = Number(data?.note);
            const velocity = Number(data?.velocity);
            if (!Number.isFinite(note) || !Number.isFinite(velocity)) return;

            if (this.patch.mono) {
                // Mono Mode: Last-note priority with retrigger.
                this.heldNotes = this.heldNotes.filter(n => n.note !== note);
                this.heldNotes.push({ note, velocity });
                this.voices = [];
                this.voices.push(new Voice(note, this.patch, velocity, this.lfo, algData));
            } else {
                if (this.voices.length >= 16) this.voices.shift();
                if (this.patch.lfoSync) this.lfo?.sync();
                this.voices.push(new Voice(note, this.patch, velocity, this.lfo, algData));
            }
            return;
        }

        if (type === 'noteOff') {
            const note = Number(data?.note);
            if (!Number.isFinite(note)) return;

            if (this.patch.mono) {
                const prevTop = this.heldNotes.length > 0 ? this.heldNotes[this.heldNotes.length - 1] : null;
                this.heldNotes = this.heldNotes.filter(n => n.note !== note);
                const newTop = this.heldNotes.length > 0 ? this.heldNotes[this.heldNotes.length - 1] : null;

                if (prevTop && prevTop.note === note) {
                    if (newTop) {
                        this.voices = [];
                        this.voices.push(new Voice(newTop.note, this.patch, newTop.velocity, this.lfo, algData));
                    } else {
                        this.voices.forEach(v => v.noteOff(this.sustain));
                    }
                }
            } else {
                this.voices.forEach(v => {
                    if (v.note === note) v.noteOff(this.sustain);
                });
            }
        }
    }

    flushScheduledEventsAtFrame(frame) {
        while (
            this.scheduledEventIndex < this.scheduledEvents.length &&
            this.scheduledEvents[this.scheduledEventIndex].frame <= frame
        ) {
            const event = this.scheduledEvents[this.scheduledEventIndex];
            this.handleIncomingEvent(event.type, event.data);
            this.scheduledEventIndex += 1;
        }
    }

    softLimit(sample) {
        const abs = Math.abs(sample);
        if (abs <= SOFT_LIMIT_THRESHOLD) return sample;
        const excess = (abs - SOFT_LIMIT_THRESHOLD) / (1 - SOFT_LIMIT_THRESHOLD);
        const limited = SOFT_LIMIT_THRESHOLD + (1 - SOFT_LIMIT_THRESHOLD) * fastTanh(excess);
        return sample < 0 ? -limited : limited;
    }

    pruneFinishedVoices() {
        let write = 0;
        for (let read = 0; read < this.voices.length; read++) {
            const voice = this.voices[read];
            if (!voice.isFinished()) {
                this.voices[write] = voice;
                write += 1;
            }
        }
        this.voices.length = write;
    }

    process(inputs, outputs) {
        const outL = outputs[0][0];
        const outR = outputs[0][1];
        if (!outL) return true;
        if (!this.algorithms || !this.patch) return true; // Wait for initialization

        // Update global SAMPLE_RATE from AudioWorkletProcessor
        if (SAMPLE_RATE !== sampleRate) {
            setProcessorSampleRate(sampleRate);
            this.monotronDelay.setSampleRate(SAMPLE_RATE);
            console.log('DX7 Processor running at', SAMPLE_RATE, 'Hz');
        }

        const atEffect = this.patch.aftertouchEnabled ? this.aftertouch : 0;
        const ctrlMod = Math.min(1.27, this.modWheel + atEffect);
        const lfo = this.lfo;
        this.pruneFinishedVoices();

        for (let i = 0; i < outL.length; i++) {
            this.flushScheduledEventsAtFrame(this.globalFrame);
            let mixed = 0;
            const sampleMeters = (this.globalFrame & 31) === 0;

            const lfoOut = lfo ? lfo.render(ctrlMod) : this.neutralLfo;

            for (let voiceIndex = 0; voiceIndex < this.voices.length; voiceIndex++) {
                const voice = this.voices[voiceIndex];
                mixed += voice.render(this.pitchBendMultiplier, lfoOut);
                if (sampleMeters) {
                    const peaks = this.meterPeaks;
                    for (let op = 0; op < 6; op++) {
                        const level = Math.abs(voice.opOutputs[op]);
                        if (level > peaks[op]) peaks[op] = level;
                    }
                }
            }
            let l = mixed;
            let r = mixed;
            if (this.monotronDelay.active) {
                this.monotronDelay.render(l, r);
                l = this.monotronDelay.outputL;
                r = this.monotronDelay.outputR;
            }
            outL[i] = this.softLimit(l);
            outR[i] = this.softLimit(r);
            this.globalFrame += 1;
        }

        // Metering: Send operator levels and envelope states every ~46ms (2048 samples)
        if (this.counter % 2048 === 0) {
            const levels = this.meterLevels;
            const states = this.meterStates;
            for (let op = 0; op < 6; op++) {
                const peak = this.meterPeaks[op];
                levels[op] = Number.isFinite(peak) ? peak : 0;
                this.meterPeaks[op] = 0;
                states[op] = 4;
            }

            if (this.voices.length > 0) {
                // Use the latest voice for visualization
                const latestVoice = this.voices[this.voices.length - 1];
                for (let op = 0; op < 6; op++) {
                    states[op] = latestVoice.envs[op].state;
                }
            }
            this.port.postMessage({ type: 'opLevels', data: new Float32Array(levels), envStates: new Int8Array(states) });
        }
        this.counter += outL.length;

        return true;
    }
}

registerProcessor('dx7-processor', DX7Processor);
