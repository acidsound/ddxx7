
import { Patch } from '../types';

const WORKLET_CODE = `
const SAMPLE_RATE = 44100;
const LFO_SAMPLE_PERIOD = 100;
const PER_VOICE_LEVEL = 0.08 / 6; // Adjusted gain for new velocity curve

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

const OL_TO_MOD_TABLE = [
	0.000000, 0.000039, 0.000078, 0.000117, 0.000157, 0.000196, 0.000254, 0.000303, 0.000360, 0.000428,
	0.000509, 0.000606, 0.000721, 0.000857, 0.001019, 0.001212, 0.001322, 0.001442, 0.001715, 0.001870,
	0.002224, 0.002425, 0.002645, 0.002884, 0.003145, 0.003430, 0.003740, 0.004079, 0.004448, 0.004851,
	0.005290, 0.005768, 0.006290, 0.006860, 0.007481, 0.008158, 0.008896, 0.009702, 0.010580, 0.011537,
	0.012582, 0.013720, 0.014962, 0.016316, 0.017793, 0.019404, 0.021160, 0.023075, 0.025163, 0.027441,
	0.029925, 0.032633, 0.035587, 0.038808, 0.042320, 0.046150, 0.050327, 0.054882, 0.059850, 0.065267,
	0.100656, 0.109766, 0.119700, 0.130534, 0.142349, 0.155232, 0.169282, 0.184603, 0.201311, 0.219532,
	0.239401, 0.261068, 0.284697, 0.310464, 0.338564, 0.369207, 0.402623, 0.439063, 0.478802, 0.522137,
	0.569394, 0.620929, 0.677128, 0.738413, 0.805245, 0.878126, 0.957603, 1.044270, 1.138790, 1.241860,
	1.354260, 1.476830, 1.610490, 1.756250, 1.915210, 2.088550, 2.277580, 2.483720, 2.708510, 2.953650
];

const OUTPUT_LUT = new Float32Array(4096);
for (let i = 0; i < 4096; i++) {
  const dB = (i - 3824) * 0.0235;
  OUTPUT_LUT[i] = Math.pow(20, (dB / 20));
}

const ALGORITHMS = [
	{ outputMix: [0,2],         modulationMatrix: [[1], [], [3], [4], [5], [5]] },
	{ outputMix: [0,2],         modulationMatrix: [[1], [1], [3], [4], [5], []] },
	{ outputMix: [0,3],         modulationMatrix: [[1], [2], [], [4], [5], [5]] },
	{ outputMix: [0,3],         modulationMatrix: [[1], [2], [], [4], [5], [3]] },
	{ outputMix: [0,2,4],       modulationMatrix: [[1], [], [3], [], [5], [5]] },
	{ outputMix: [0,2,4],       modulationMatrix: [[1], [], [3], [], [5], [4]] },
	{ outputMix: [0,2],         modulationMatrix: [[1], [], [3,4], [], [5], [5]] },
	{ outputMix: [0,2],         modulationMatrix: [[1], [], [3,4], [3], [5], []] },
	{ outputMix: [0,2],         modulationMatrix: [[1], [1], [3,4], [], [5], []] },
	{ outputMix: [0,3],         modulationMatrix: [[1], [2], [2], [4,5], [], []] },
	{ outputMix: [0,3],         modulationMatrix: [[1], [2], [], [4,5], [], [5]] },
	{ outputMix: [0,2],         modulationMatrix: [[1], [1], [3,4,5], [], [], []] },
	{ outputMix: [0,2],         modulationMatrix: [[1], [], [3,4,5], [], [], [5]] },
	{ outputMix: [0,2],         modulationMatrix: [[1], [], [3], [4,5], [], [5]] },
	{ outputMix: [0,2],         modulationMatrix: [[1], [1], [3], [4,5], [], []] },
	{ outputMix: [0],           modulationMatrix: [[1,2,4], [], [3], [], [5], [5]] },
	{ outputMix: [0],           modulationMatrix: [[1,2,4], [1], [3], [], [5], []] },
	{ outputMix: [0],           modulationMatrix: [[1,2,3], [], [2], [4], [5], []] },
	{ outputMix: [0,3,4],       modulationMatrix: [[1], [2], [], [5], [5], [5]] },
	{ outputMix: [0,1,3],       modulationMatrix: [[2], [2], [2], [4,5], [], []] },
	{ outputMix: [0,1,3,4],     modulationMatrix: [[2], [2], [2], [5], [5], []] },
	{ outputMix: [0,2,3,4],     modulationMatrix: [[1], [], [5], [5], [5], [5]] },
	{ outputMix: [0,1,3,4],     modulationMatrix: [[], [2], [], [5], [5], [5]] },
	{ outputMix: [0,1,2,3,4],   modulationMatrix: [[], [], [5], [5], [5], [5]] },
	{ outputMix: [0,1,2,3,4],   modulationMatrix: [[], [], [], [5], [5], [5]] },
	{ outputMix: [0,1,3],       modulationMatrix: [[], [2], [], [4,5], [], [5]] },
	{ outputMix: [0,1,3],       modulationMatrix: [[], [2], [2], [4,5], [], []] },
	{ outputMix: [0,2,5],       modulationMatrix: [[1], [], [3], [4], [4], []] },
	{ outputMix: [0,1,2,4],     modulationMatrix: [[], [], [3], [], [5], [5]] },
	{ outputMix: [0,1,2,5],     modulationMatrix: [[], [], [3], [4], [4], []] },
	{ outputMix: [0,1,2,3,4],   modulationMatrix: [[], [], [], [], [5], [5]] },
	{ outputMix: [0,1,2,3,4,5], modulationMatrix: [[], [], [], [], [], [5]] }
];

class LfoDX7 {
    constructor(opParams) {
        this.opParams = opParams;
        this.phase = 0;
        this.pitchVal = 1;
        this.counter = 0;
        this.ampVal = 1;
        this.ampValTarget = 1;
        this.ampIncrement = 0;
        this.delayVal = 0;
        this.delayState = 0; 
        this.params = null;
    }
    setParams(p) { this.params = p; }
    render() {
        if (!this.params) return 1;
        if (this.counter % LFO_SAMPLE_PERIOD === 0) {
            this.pitchVal = 1.0; 
            const ampSensDepth = Math.abs(this.opParams.lfoAmpModSens) * 0.333333;
            this.ampValTarget = 1.0; // Simplified for now
            this.ampIncrement = (this.ampValTarget - this.ampVal) / LFO_SAMPLE_PERIOD;
        }
        this.counter++;
        return this.pitchVal;
    }
    renderAmp() {
        this.ampVal += this.ampIncrement;
        return this.ampVal;
    }
}

class EnvelopeDX7 {
    constructor(levels, rates) {
        this.levels = levels;
        this.rates = rates;
        this.level = 0;
        this.state = 0;
        this.down = true;
        this.decayIncrement = 0;
        this.targetlevel = 0;
        this.rising = false;
        this.advance(0);
    }
    render() {
        if (this.state < 3 || (this.state < 4 && !this.down)) {
            if (this.rising) {
                this.level += this.decayIncrement * (2 + (this.targetlevel - this.level) / 256);
                if (this.level >= this.targetlevel) { this.level = this.targetlevel; this.advance(this.state + 1); }
            } else {
                this.level -= this.decayIncrement;
                if (this.level <= this.targetlevel) { this.level = this.targetlevel; this.advance(this.state + 1); }
            }
        }
        return OUTPUT_LUT[Math.floor(this.level)] || 0;
    }
    advance(newstate) {
        this.state = newstate;
        if (this.state < 4) {
            const nl = Math.min(99, Math.max(0, this.levels[this.state]));
            const mapped = [0, 5, 9, 13, 17, 20, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 42, 43, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127][nl];
            this.targetlevel = Math.max(0, (mapped << 5) - 224);
            this.rising = (this.targetlevel - this.level) > 0;
            const qr = Math.min(63, (this.rates[this.state] * 41) >> 6);
            this.decayIncrement = Math.pow(2, qr / 4) / 2048;
        }
    }
    noteOff() { this.down = false; this.advance(3); }
    isFinished() { return this.state === 4; }
}

class Operator {
    constructor(params, baseFreq, env, lfo) {
        this.params = params;
        this.env = env;
        this.lfo = lfo;
        this.phase = 0;
        this.val = 0;
        this.phaseStep = 0;
        const nl = Math.min(99, Math.max(0, params.volume));
        this.modLevel = OL_TO_MOD_TABLE[nl] || 0;
        this.outLevel = OUTPUT_LEVEL_TABLE[nl] || 0;
        this.updateFreq(baseFreq);
    }
    updateFreq(f) {
        const ratio = (this.params.oscMode === 0) ? (this.params.freqCoarse || 0.5) * (1 + this.params.freqFine / 100) : Math.pow(10, this.params.freqCoarse % 4) * (1 + (this.params.freqFine / 99) * 8.772);
        this.phaseStep = (Math.PI * 2 * f * ratio * Math.pow(1.0006771307, this.params.detune - 7)) / SAMPLE_RATE;
    }
    render(mod) {
        this.val = Math.sin(this.phase + mod) * this.env.render();
        this.phase += this.phaseStep;
        if (this.phase >= Math.PI * 2) this.phase -= Math.PI * 2;
        return this.val;
    }
}

class FMVoice {
    constructor(note, patch, velocity) {
        this.note = note;
        this.patch = patch;
        this.velocity = Math.max(0, Math.min(1.0, velocity)); // Force 0-1 range
        const freq = 440 * Math.pow(2, (note - 69) / 12);
        this.operators = patch.operators.map(p => new Operator(p, freq, new EnvelopeDX7(p.levels, p.rates), new LfoDX7(p)));
    }
    render() {
        const alg = ALGORITHMS[this.patch.algorithm - 1];
        const fbRatio = Math.pow(2, (this.patch.feedback - 7));
        
        // Dynamic velocity curve:
        // Use an exponential power to ensure it hits zero properly.
        // If sensitivity is 0, curve is velocity^1.5 (still goes to 0).
        // If sensitivity is 7, curve is velocity^2.5 (sharper drop).
        const masterVelocityScale = Math.pow(this.velocity, 1.5 + (this.patch.operators[0].velocitySens / 14));

        let outL = 0, outR = 0;
        for (let i = 5; i >= 0; i--) {
            let mod = 0;
            alg.modulationMatrix[i].forEach(m => {
                const modOp = this.operators[m];
                // Modulation depth also scales with velocity for brightness response
                const mScale = Math.pow(this.velocity, 1.0 + (modOp.params.velocitySens / 7));
                mod += (m === i) ? modOp.val * fbRatio : modOp.val * modOp.modLevel * mScale;
            });
            this.operators[i].render(mod);
        }
        
        alg.outputMix.forEach(idx => {
            const op = this.operators[idx];
            // Hardware sensitivity influence (standard DX7-ish logic combined with master curve)
            const hwVSens = 1.0 + (this.velocity - 1.0) * (op.params.velocitySens / 7.0);
            const vScale = masterVelocityScale * hwVSens;

            const level = op.val * op.outLevel * Math.max(0, vScale);
            outL += level * op.params.ampL;
            outR += level * op.params.ampR;
        });
        return [outL, outR];
    }
    noteOff() { this.operators.forEach(o => o.env.noteOff()); }
    isFinished() { 
        const alg = ALGORITHMS[this.patch.algorithm - 1];
        return alg.outputMix.every(idx => this.operators[idx].env.isFinished());
    }
}

class DX7Processor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.voices = [];
        this.patch = null;
        this.port.onmessage = (e) => {
            const { type, data } = e.data;
            if (type === 'patch') { this.patch = data; } 
            else if (type === 'noteOn') {
                if (this.patch) {
                    if (this.voices.length > 12) this.voices.shift();
                    this.voices.push(new FMVoice(data.note, this.patch, data.velocity));
                }
            } else if (type === 'noteOff') {
                this.voices.filter(v => v.note === data.note).forEach(v => v.noteOff());
            }
        };
    }
    process(inputs, outputs) {
        const output = outputs[0];
        const channelL = output[0];
        const channelR = output[1];
        this.voices = this.voices.filter(v => !v.isFinished());
        for (let i = 0; i < channelL.length; i++) {
            let blockL = 0, blockR = 0;
            for (let j = 0; j < this.voices.length; j++) {
                const [vl, vr] = this.voices[j].render();
                blockL += vl; blockR += vr;
            }
            channelL[i] = blockL * PER_VOICE_LEVEL;
            if (channelR) channelR[i] = blockR * PER_VOICE_LEVEL;
        }
        return true;
    }
}
registerProcessor('dx7-processor', DX7Processor);
`;

export class DX7Engine {
    private ctx: AudioContext | null = null;
    private node: AudioWorkletNode | null = null;
    private patch: Patch;

    constructor(patch: Patch) {
        this.patch = patch;
    }

    private async init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
        const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        try {
            await this.ctx.audioWorklet.addModule(url);
            this.node = new AudioWorkletNode(this.ctx, 'dx7-processor', { outputChannelCount: [2] });
            this.node.connect(this.ctx.destination);
            this.updatePatch(this.patch);
        } catch (e) {
            console.error("AudioWorklet initialization failed", e);
        }
    }

    public updatePatch(p: Patch) { 
        this.patch = p; 
        if (this.node) { this.node.port.postMessage({ type: 'patch', data: p }); }
    }

    public async noteOn(n: number, velocity: number = 0.8) {
        if (!this.ctx) await this.init();
        if (this.ctx?.state === 'suspended') await this.ctx.resume();
        if (this.node) this.node.port.postMessage({ type: 'noteOn', data: { note: n, velocity } });
    }

    public noteOff(n: number) {
        if (this.node) this.node.port.postMessage({ type: 'noteOff', data: { note: n } });
    }
}
