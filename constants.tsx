
import { Patch } from './types';

export const DEFAULT_PATCH: Patch = {
  name: "INIT VOICE",
  algorithm: 1,
  feedback: 0,
  operators: Array(6).fill(null).map((_, i) => ({
    volume: i === 0 ? 99 : 0,
    freqCoarse: 1,
    freqFine: 0,
    detune: 7,
    rates: [99, 99, 99, 99] as [number, number, number, number],
    levels: [99, 99, 99, 99] as [number, number, number, number],
    keyScaleRate: 0,
    keyScaleBreakpoint: 27,
    keyScaleCurveL: 0,
    keyScaleCurveR: 0,
    keyScaleDepthL: 0,
    keyScaleDepthR: 0,
    velocitySens: 3,
    lfoAmpModSens: 0,
    oscMode: 0,
    ampL: 1,
    ampR: 1
  })),
  lfoSpeed: 35,
  lfoDelay: 0,
  lfoPitchModDepth: 0,
  lfoAmpModDepth: 0,
  lfoPitchModSens: 3,
  lfoSync: true,
  oscKeySync: true,
  lfoWaveform: 0,
  pitchEnvelope: {
    rates: [99, 99, 99, 99] as [number, number, number, number],
    levels: [50, 50, 50, 50] as [number, number, number, number],
  },
  transpose: 24,
  fineTune: 0,
  cutoff: 99,
  resonance: 0,
  masterLevel: 80,
  mono: false,
  aftertouchEnabled: false,
  reverbDepth: 0
};

export const ALGORITHMS = [
  { id: 1, carriers: [1, 3], modulators: { 1: [2], 2: [], 3: [4], 4: [5, 6], 5: [], 6: [] } },
];
