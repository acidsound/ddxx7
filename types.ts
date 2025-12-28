
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
  lfoSync: boolean;
  pitchEnvelope: {
    rates: [number, number, number, number];
    levels: [number, number, number, number];
  };
  transpose: number;
  mono: boolean;
}

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
}
