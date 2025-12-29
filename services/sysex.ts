import { Patch, OperatorParams } from '../types';

export class SysExHandler {
  static parseFile(buffer: ArrayBuffer): Patch[] {
    const data = new Uint8Array(buffer);
    
    // 32-Voice Bulk Dump (VMEM)
    if (data[0] === 0xF0 && data[1] === 0x43 && (data[3] === 0x09 || data[3] === 0x08)) {
      const patches: Patch[] = [];
      for (let i = 0; i < 32; i++) {
        const start = 6 + (i * 128);
        if (start + 128 > data.length) break;
        patches.push(this.unpackVoice(data.slice(start, start + 128)));
      }
      return patches;
    }

    // Headerless 4096-byte dump
    if (data.length === 4096) {
      const patches: Patch[] = [];
      for (let i = 0; i < 32; i++) {
        patches.push(this.unpackVoice(data.slice(i * 128, (i + 1) * 128)));
      }
      return patches;
    }
    
    // Single VCED
    if (data[0] === 0xF0 && data[1] === 0x43 && (data[3] & 0x0F) === 0x00) {
        if (data.length >= 161) {
            return [this.unpackUnpackedVoice(data.slice(6, 6 + 155))];
        }
    }

    return [];
  }

  private static unpackVoice(d: Uint8Array): Patch {
    const operators: OperatorParams[] = [];
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
        detune: (d[s+12] >> 3) & 0x0F, // DX7 Detune is bits 3-6 of byte 12 (0-14 range)
        lfoAmpModSens: d[s+13] & 3,
        velocitySens: d[s+13] >> 2,
        volume: d[s+14],
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
      lfoPitchModSens: d[116] >> 4,
      lfoWaveform: (d[116] >> 1) & 7,
      lfoSync: !!(d[116] & 1),
      oscKeySync: true,
      pitchEnvelope: {
        rates: [d[102], d[103], d[104], d[105]],
        levels: [d[106], d[107], d[108], d[109]]
      },
      transpose: d[117],
      fineTune: 0,
      cutoff: 99,
      resonance: 0,
      masterLevel: 80,
      mono: false,
      aftertouchEnabled: false,
      reverbDepth: 0
    };
  }

  private static unpackUnpackedVoice(d: Uint8Array): Patch {
    const operators: OperatorParams[] = [];
    for (let i = 5; i >= 0; i--) {
        const s = (5 - i) * 21;
        operators[i] = {
            rates: [d[s], d[s+1], d[s+2], d[s+3]],
            levels: [d[s+4], d[s+5], d[s+6], d[s+7]],
            keyScaleBreakpoint: d[s+8],
            keyScaleDepthL: d[s+9],
            keyScaleDepthR: d[s+10],
            keyScaleCurveL: d[s+11],
            keyScaleCurveR: d[s+12],
            keyScaleRate: d[s+13],
            detune: d[s+14] & 0x0F, // Detune byte in single VCED (0-14)
            lfoAmpModSens: d[s+15],
            velocitySens: d[s+16],
            volume: d[s+17],
            oscMode: d[s+18],
            freqCoarse: d[s+19],
            freqFine: d[s+20],
            ampL: 1.0,
            ampR: 1.0
        };
    }
    const name = new TextDecoder().decode(d.slice(144, 154)).replace(/[^\x20-\x7E]/g, '').trim() || "INIT VOICE";
    return {
        name,
        algorithm: d[134] + 1,
        feedback: d[135] & 7,
        operators,
        lfoSpeed: d[136],
        lfoDelay: d[137],
        lfoPitchModDepth: d[138],
        lfoAmpModDepth: d[139],
        lfoSync: !!d[140],
        oscKeySync: true,
        lfoWaveform: d[141],
        lfoPitchModSens: d[142],
        pitchEnvelope: {
            rates: [d[126], d[127], d[128], d[129]],
            levels: [d[130], d[131], d[132], d[133]]
        },
        transpose: d[143],
        fineTune: 0,
        cutoff: 99,
        resonance: 0,
        masterLevel: 80,
        mono: false,
        aftertouchEnabled: false,
        reverbDepth: 0
    };
  }

  static createSingleVoiceDump(patch: Patch, deviceId: number = 0): Uint8Array {
    const vced = new Uint8Array(155).fill(0);
    for (let i = 5; i >= 0; i--) {
        const s = (5 - i) * 21;
        const op = patch.operators[i];
        vced[s] = op.rates[0]; vced[s+1] = op.rates[1]; vced[s+2] = op.rates[2]; vced[s+3] = op.rates[3];
        vced[s+4] = op.levels[0]; vced[s+5] = op.levels[1]; vced[s+6] = op.levels[2]; vced[s+7] = op.levels[3];
        vced[s+8] = op.keyScaleBreakpoint; vced[s+9] = op.keyScaleDepthL; vced[s+10] = op.keyScaleDepthR;
        vced[s+11] = op.keyScaleCurveL; vced[s+12] = op.keyScaleCurveR; vced[s+13] = op.keyScaleRate;
        vced[s+14] = op.detune; // Internally already 0-14, send as is
        vced[s+15] = op.lfoAmpModSens; vced[s+16] = op.velocitySens;
        vced[s+17] = op.volume; vced[s+18] = op.oscMode; vced[s+19] = op.freqCoarse; vced[s+20] = op.freqFine;
    }
    vced[126] = patch.pitchEnvelope.rates[0]; vced[127] = patch.pitchEnvelope.rates[1]; vced[128] = patch.pitchEnvelope.rates[2]; vced[129] = patch.pitchEnvelope.rates[3];
    vced[130] = patch.pitchEnvelope.levels[0]; vced[131] = patch.pitchEnvelope.levels[1]; vced[132] = patch.pitchEnvelope.levels[2]; vced[133] = patch.pitchEnvelope.levels[3];
    vced[134] = (patch.algorithm - 1) & 31; vced[135] = patch.feedback & 7;
    vced[136] = patch.lfoSpeed; vced[137] = patch.lfoDelay; vced[138] = patch.lfoPitchModDepth; vced[139] = patch.lfoAmpModDepth;
    vced[140] = patch.lfoSync ? 1 : 0; vced[141] = patch.lfoWaveform & 7; vced[142] = patch.lfoPitchModSens & 7; vced[143] = patch.transpose;
    
    const encoder = new TextEncoder();
    const nameStr = (patch.name + "          ").substring(0, 10).toUpperCase();
    const nameBytes = encoder.encode(nameStr);
    for(let i=0; i<10; i++) vced[144 + i] = nameBytes[i];
    vced[154] = 0x3F;

    const msg = new Uint8Array(163);
    msg[0] = 0xF0; msg[1] = 0x43; msg[2] = deviceId & 0x0F; msg[3] = 0x00;
    msg[4] = 0x01; msg[5] = 0x1B;
    msg.set(vced, 6);
    let sum = 0;
    for (let i = 6; i < 161; i++) sum += msg[i];
    msg[161] = (0x80 - (sum & 0x7F)) & 0x7F;
    msg[162] = 0xF7;
    return msg;
  }
}