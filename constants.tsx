
import { Patch } from './types';

// Fix: DEFAULT_PATCH must implement all properties from the Patch and OperatorParams interfaces.
// Renamed property names (e.g., level -> volume, coarse -> freqCoarse) to match the defined interfaces.
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
    velocitySens: 0,
    lfoAmpModSens: 0,
    oscMode: 0,
    ampL: 1,
    ampR: 1
  })),
  lfoSpeed: 35,
  lfoDelay: 0,
  lfoPitchModDepth: 0,
  lfoAmpModDepth: 0,
  lfoPitchModSens: 0,
  lfoSync: true,
  lfoWaveform: 0,
  pitchEnvelope: {
    rates: [99, 99, 99, 99] as [number, number, number, number],
    levels: [50, 50, 50, 50] as [number, number, number, number],
  },
  transpose: 24,
  mono: false
};

// Simplified algorithm representation: carriers and their modulators
export const ALGORITHMS = [
  // This is a mapping used by the engine to connect nodes
  // In a real DX7, there are 32. We implement a subset for the demo or structure it generically.
  { id: 1, carriers: [1, 3], modulators: { 1: [2], 2: [], 3: [4], 4: [5, 6], 5: [], 6: [] } },
  // ... more mappings
];
