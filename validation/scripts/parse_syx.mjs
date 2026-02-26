import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DETUNE_MIDPOINT = 7;

function safeAscii(bytes) {
  return Buffer.from(bytes).toString('ascii').replace(/[^\x20-\x7E]/g, ' ').trim() || 'INIT VOICE';
}

function parseVoiceBlock(block) {
  const operators = [];
  for (let i = 5; i >= 0; i -= 1) {
    const start = (5 - i) * 17;
    const keyRateAndDetune = block[start + 12];
    operators[i] = {
      rates: [block[start], block[start + 1], block[start + 2], block[start + 3]],
      levels: [block[start + 4], block[start + 5], block[start + 6], block[start + 7]],
      keyScaleBreakpoint: block[start + 8],
      keyScaleDepthL: block[start + 9],
      keyScaleDepthR: block[start + 10],
      keyScaleCurveL: block[start + 11] & 3,
      keyScaleCurveR: (block[start + 11] >> 2) & 3,
      keyScaleRate: keyRateAndDetune & 7,
      detuneRaw: (keyRateAndDetune >> 3) & 0x0f,
      lfoAmpModSens: block[start + 13] & 3,
      velocitySens: block[start + 13] >> 2,
      volume: block[start + 14],
      oscMode: block[start + 15] & 1,
      freqCoarse: block[start + 15] >> 1,
      freqFine: block[start + 16]
    };
  }

  return {
    name: safeAscii(block.slice(118, 128)),
    algorithm: (block[110] & 31) + 1,
    feedback: block[111] & 7,
    oscKeySync: !!(block[111] & 8),
    lfoSpeed: block[112],
    lfoDelay: block[113],
    lfoPitchModDepth: block[114],
    lfoAmpModDepth: block[115],
    lfoPitchModSens: block[116] >> 4,
    lfoWaveform: (block[116] >> 1) & 7,
    lfoSync: !!(block[116] & 1),
    transpose: block[117],
    pitchEnvelope: {
      rates: [block[102], block[103], block[104], block[105]],
      levels: [block[106], block[107], block[108], block[109]]
    },
    operators
  };
}

function parseFromBulk(data) {
  const patches = [];
  for (let i = 0; i < 32; i += 1) {
    const start = 6 + i * 128;
    const end = start + 128;
    if (end > data.length) break;
    patches.push(parseVoiceBlock(data.slice(start, end)));
  }
  return patches;
}

function parseFromHeaderless(data) {
  const patches = [];
  for (let i = 0; i < 32; i += 1) {
    const start = i * 128;
    const end = start + 128;
    if (end > data.length) break;
    patches.push(parseVoiceBlock(data.slice(start, end)));
  }
  return patches;
}

export function parseSyxBuffer(buffer) {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (data.length === 4096) {
    return parseFromHeaderless(data);
  }
  const isBulk = data[0] === 0xf0 && data[1] === 0x43 && (data[3] === 0x09 || data[3] === 0x08);
  if (isBulk) {
    return parseFromBulk(data);
  }
  throw new Error(`Unsupported SYX format (length=${data.length})`);
}

export function parseSyxFile(filePath) {
  return parseSyxBuffer(fs.readFileSync(filePath));
}

export function loadPatchLibrary(inputPath) {
  const absPath = path.resolve(inputPath);
  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) {
    const files = fs.readdirSync(absPath)
      .filter((name) => name.toLowerCase().endsWith('.syx'))
      .sort((a, b) => a.localeCompare(b));
    const all = [];
    files.forEach((name) => {
      const file = path.resolve(absPath, name);
      const patches = parseSyxFile(file).map((patch) => ({
        ...patch,
        sourceFile: file
      }));
      all.push(...patches);
    });
    return all;
  }
  if (stat.isFile()) {
    return parseSyxFile(absPath).map((patch) => ({
      ...patch,
      sourceFile: absPath
    }));
  }
  throw new Error(`Unsupported path type: ${absPath}`);
}

export function findPatchByAlgorithm(patches, algorithm, occurrence = 0) {
  const matches = [];
  patches.forEach((patch, idx) => {
    if (patch.algorithm === algorithm) {
      matches.push({ patch, index: idx });
    }
  });
  if (matches.length === 0) {
    throw new Error(`No patch found for algorithm ${algorithm}`);
  }
  return matches[Math.min(occurrence, matches.length - 1)];
}

export function resolvePatchForCase(patches, caseSpec) {
  if (Number.isInteger(caseSpec.patchIndex)) {
    const idx = Number(caseSpec.patchIndex);
    if (idx < 0 || idx >= patches.length) {
      throw new Error(`Invalid patchIndex ${idx} for case ${caseSpec.id}`);
    }
    return { patch: patches[idx], index: idx };
  }
  if (caseSpec.patchSelection === 'firstByAlgorithm' || !caseSpec.patchSelection) {
    try {
      return findPatchByAlgorithm(patches, Number(caseSpec.algorithm), Number(caseSpec.patchOccurrence ?? 0));
    } catch (error) {
      if (!patches.length) throw error;
      const base = patches[0];
      return {
        patch: {
          ...base,
          name: `FALLBACK A${String(caseSpec.algorithm).padStart(2, '0')}`,
          algorithm: Number(caseSpec.algorithm),
          sourceFile: base.sourceFile
        },
        index: -1,
        fallback: true
      };
    }
  }
  throw new Error(`Unsupported patchSelection "${caseSpec.patchSelection}" in case ${caseSpec.id}`);
}

export function toDdxxPatch(canonical) {
  return {
    name: canonical.name,
    algorithm: canonical.algorithm,
    feedback: canonical.feedback,
    operators: canonical.operators.map((op) => ({
      rates: [...op.rates],
      levels: [...op.levels],
      keyScaleBreakpoint: op.keyScaleBreakpoint,
      keyScaleDepthL: op.keyScaleDepthL,
      keyScaleDepthR: op.keyScaleDepthR,
      keyScaleCurveL: op.keyScaleCurveL,
      keyScaleCurveR: op.keyScaleCurveR,
      keyScaleRate: op.keyScaleRate,
      detune: op.detuneRaw,
      lfoAmpModSens: op.lfoAmpModSens,
      velocitySens: op.velocitySens,
      volume: op.volume,
      oscMode: op.oscMode,
      freqCoarse: op.freqCoarse,
      freqFine: op.freqFine,
      ampL: 1.0,
      ampR: 1.0
    })),
    lfoSpeed: canonical.lfoSpeed,
    lfoDelay: canonical.lfoDelay,
    lfoPitchModDepth: canonical.lfoPitchModDepth,
    lfoAmpModDepth: canonical.lfoAmpModDepth,
    lfoPitchModSens: canonical.lfoPitchModSens,
    lfoWaveform: canonical.lfoWaveform,
    lfoSync: canonical.lfoSync,
    oscKeySync: canonical.oscKeySync,
    pitchEnvelope: {
      rates: [...canonical.pitchEnvelope.rates],
      levels: [...canonical.pitchEnvelope.levels]
    },
    transpose: canonical.transpose,
    fineTune: 0,
    cutoff: 99,
    resonance: 0,
    masterLevel: 80,
    mono: false,
    aftertouchEnabled: false,
    reverbDepth: 0
  };
}

export function toReferencePatch(canonical) {
  return {
    name: canonical.name,
    algorithm: canonical.algorithm,
    feedback: canonical.feedback,
    operators: canonical.operators.map((op, idx) => ({
      rates: [...op.rates],
      levels: [...op.levels],
      keyScaleBreakpoint: op.keyScaleBreakpoint,
      keyScaleDepthL: op.keyScaleDepthL,
      keyScaleDepthR: op.keyScaleDepthR,
      keyScaleCurveL: op.keyScaleCurveL,
      keyScaleCurveR: op.keyScaleCurveR,
      keyScaleRate: op.keyScaleRate,
      detune: op.detuneRaw - DETUNE_MIDPOINT,
      lfoAmpModSens: op.lfoAmpModSens,
      velocitySens: op.velocitySens,
      volume: op.volume,
      oscMode: op.oscMode,
      freqCoarse: op.freqCoarse,
      freqFine: op.freqFine,
      pan: (((idx + 1) % 3) - 1) * 25,
      idx,
      enabled: true
    })),
    lfoSpeed: canonical.lfoSpeed,
    lfoDelay: canonical.lfoDelay,
    lfoPitchModDepth: canonical.lfoPitchModDepth,
    lfoAmpModDepth: canonical.lfoAmpModDepth,
    lfoPitchModSens: canonical.lfoPitchModSens,
    lfoWaveform: canonical.lfoWaveform,
    lfoSync: canonical.lfoSync,
    pitchEnvelope: {
      rates: [...canonical.pitchEnvelope.rates],
      levels: [...canonical.pitchEnvelope.levels]
    },
    controllerModVal: 0,
    aftertouchEnabled: 0
  };
}

function printSummary(patches) {
  const byAlgorithm = new Map();
  patches.forEach((patch, idx) => {
    const key = patch.algorithm;
    if (!byAlgorithm.has(key)) byAlgorithm.set(key, []);
    byAlgorithm.get(key).push({ idx, name: patch.name });
  });
  const sorted = [...byAlgorithm.entries()].sort((a, b) => a[0] - b[0]);
  sorted.forEach(([algorithm, list]) => {
    console.log(`ALG ${String(algorithm).padStart(2, '0')}: ${list.length} patches`);
  });
}

function parseArg(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function main() {
  const filePath = parseArg('--file');
  const dirPath = parseArg('--dir');
  const summary = process.argv.includes('--summary');
  if (!filePath && !dirPath) {
    console.error('Usage: node validation/scripts/parse_syx.mjs (--file <path> | --dir <path>) [--summary]');
    process.exit(2);
  }
  const absPath = path.resolve(filePath ?? dirPath);
  const patches = loadPatchLibrary(absPath);
  console.log(`Loaded ${patches.length} patches from ${absPath}`);
  if (summary) printSummary(patches);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
