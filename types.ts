
export interface OperatorParams {
  rates: [number, number, number, number];
  levels: [number, number, number, number];
  keyScaleBreakpoint: number;
  keyScaleDepthL: number;
  keyScaleDepthR: number;
  keyScaleCurveL: number;
  keyScaleCurveR: number;
  keyScaleRate: number;
  detune: number; // 0 to 14, 7 is middle
  lfoAmpModSens: number;
  velocitySens: number;
  volume: number; // output level
  oscMode: number; // 0=ratio, 1=fixed
  freqCoarse: number;
  freqFine: number;
  // Internal/Extended
  ampL: number;
  ampR: number;
}

export interface Patch {
  name: string;
  algorithm: number;
  feedback: number;
  operators: OperatorParams[];
  lfoSpeed: number;
  lfoDelay: number;
  lfoPitchModDepth: number;
  lfoAmpModDepth: number;
  lfoPitchModSens: number;
  lfoWaveform: number;
  lfoSync: boolean; // This is LFO Key Sync
  oscKeySync: boolean;
  pitchEnvelope: {
    rates: [number, number, number, number];
    levels: [number, number, number, number];
  };
  transpose: number;
  fineTune: number; // -50 to 50
  cutoff: number;
  resonance: number;
  masterLevel: number;
  mono: boolean;
  aftertouchEnabled: boolean;
  reverbDepth: number;
}

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
}
