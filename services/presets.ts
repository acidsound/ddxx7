
import { Patch, OperatorParams } from '../types';

const createDefaultOp = (vol = 0): OperatorParams => ({
  rates: [99, 99, 99, 99],
  levels: [99, 99, 99, 99],
  keyScaleBreakpoint: 27,
  keyScaleDepthL: 0,
  keyScaleDepthR: 0,
  keyScaleCurveL: 0,
  keyScaleCurveR: 0,
  keyScaleRate: 0,
  detune: 7,
  lfoAmpModSens: 0,
  velocitySens: 3, // Set to 3 by default instead of 0 for immediate keyboard responsiveness
  volume: vol,
  oscMode: 0,
  freqCoarse: 1,
  freqFine: 0,
  ampL: 1,
  ampR: 1,
});

export const PRESETS: Patch[] = [
  {
    name: "BRASS 1",
    algorithm: 1,
    feedback: 0,
    operators: [
      { ...createDefaultOp(99), freqCoarse: 1, velocitySens: 2 },
      { ...createDefaultOp(75), freqCoarse: 1, velocitySens: 4 },
      { ...createDefaultOp(0), freqCoarse: 1 },
      { ...createDefaultOp(0), freqCoarse: 1 },
      { ...createDefaultOp(0), freqCoarse: 1 },
      { ...createDefaultOp(0), freqCoarse: 1 },
    ],
    lfoSpeed: 35, lfoDelay: 0, lfoPitchModDepth: 0, lfoAmpModDepth: 0, lfoPitchModSens: 3, lfoWaveform: 0, lfoSync: true,
    pitchEnvelope: { rates: [99, 99, 99, 99], levels: [50, 50, 50, 50] },
    transpose: 24, mono: false
  },
  {
    name: "E.PIANO 1",
    algorithm: 5,
    feedback: 7,
    operators: [
      { ...createDefaultOp(99), freqCoarse: 1, velocitySens: 3 },
      { ...createDefaultOp(85), freqCoarse: 14, velocitySens: 5 },
      { ...createDefaultOp(99), freqCoarse: 1, velocitySens: 2 },
      { ...createDefaultOp(78), freqCoarse: 0, freqFine: 50, velocitySens: 4 },
      { ...createDefaultOp(99), freqCoarse: 1, velocitySens: 2 },
      { ...createDefaultOp(0), freqCoarse: 1 },
    ],
    lfoSpeed: 35, lfoDelay: 0, lfoPitchModDepth: 0, lfoAmpModDepth: 0, lfoPitchModSens: 3, lfoWaveform: 0, lfoSync: true,
    pitchEnvelope: { rates: [99, 99, 99, 99], levels: [50, 50, 50, 50] },
    transpose: 24, mono: false
  }
];
