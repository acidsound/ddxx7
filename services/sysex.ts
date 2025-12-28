
import { Patch, OperatorParams } from '../types';

export class SysExHandler {
  static parseFile(buffer: ArrayBuffer): Patch[] {
    const data = new Uint8Array(buffer);
    
    // Check for Yamaha ID (0x43) and Bulk Dump Format (0x09)
    // F0 43 0n 09 20 00 ... F7 (32 voices)
    if (data[0] === 0xF0 && data[1] === 0x43 && data[3] === 0x09) {
      const patches: Patch[] = [];
      // Data starts at byte 6
      for (let i = 0; i < 32; i++) {
        const start = 6 + (i * 128);
        const voiceData = data.slice(start, start + 128);
        patches.push(this.unpackVoice(voiceData));
      }
      return patches;
    }
    
    // Single Voice (Format 0) - F0 43 0n 00 01 1b ... F7
    if (data[0] === 0xF0 && data[1] === 0x43 && data[3] === 0x00) {
        // Simplified single voice unpack for VCED format
        return [this.unpackVoice(data.slice(6, 6 + 128))];
    }

    return [];
  }

  private static unpackVoice(d: Uint8Array): Patch {
    const operators: OperatorParams[] = [];
    // DX7 Bulk format stores operators in reverse order (6, 5, 4, 3, 2, 1)
    for (let i = 5; i >= 0; i--) {
      const s = (5 - i) * 17;
      operators[i] = {
        rates: [d[s], d[s+1], d[s+2], d[s+3]],
        levels: [d[s+4], d[s+5], d[s+6], d[s+7]],
        keyScaleBreakpoint: d[s+8],
        keyScaleDepthL: d[s+9],
        keyScaleDepthR: d[s+10],
        keyScaleCurveL: d[s+11] & 3,
        keyScaleCurveR: (d[s+11] >> 2) & 3,
        keyScaleRate: d[s+12] & 7,
        detune: (d[s+12] >> 3) - 7, // range -7 to +7
        lfoAmpModSens: d[s+13] & 3,
        velocitySens: d[s+13] >> 2,
        volume: d[s+14], // Output Level
        oscMode: d[s+15] & 1,
        freqCoarse: d[s+15] >> 1,
        freqFine: d[s+16],
        ampL: 1.0,
        ampR: 1.0
      };
    }

    const name = new TextDecoder().decode(d.slice(118, 128)).replace(/[^\x20-\x7E]/g, '').trim() || "INIT VOICE";

    return {
      name,
      algorithm: (d[110] & 31) + 1,
      feedback: d[111] & 7,
      operators,
      lfoSpeed: d[112],
      lfoDelay: d[113],
      lfoPitchModDepth: d[114],
      lfoAmpModDepth: d[115],
      lfoSync: !!(d[116] & 1),
      lfoWaveform: (d[116] >> 1) & 7,
      lfoPitchModSens: d[116] >> 4,
      pitchEnvelope: {
        rates: [d[102], d[103], d[104], d[105]],
        levels: [d[106], d[107], d[108], d[109]]
      },
      transpose: d[117],
      mono: false
    };
  }

  static createSingleVoiceDump(patch: Patch): Uint8Array {
    const data = new Uint8Array(163);
    data[0] = 0xF0; data[1] = 0x43; data[2] = 0x00; // Channel 0
    data[3] = 0x00; // Format 0
    // Header for VCED
    data[162] = 0xF7;
    // In a real implementation, we would pack the patch back into the 155 data bytes
    return data;
  }
}
