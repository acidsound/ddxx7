import { createRequire } from 'node:module';
import path from 'node:path';

import {
  countNonFinite,
  defaultCasesPath,
  defaultOutRef,
  defaultRomPath,
  ensureDir,
  readJson,
  referenceRepoCache,
  sha256File,
  writeJson,
  writeStereoWav16
} from './common.mjs';
import {
  loadPatchLibrary,
  resolvePatchForCase,
  toReferencePatch
} from './parse_syx.mjs';
import { normalizeCaseEvents } from './common.mjs';

function parseOptions(argv) {
  const opts = {
    casesPath: defaultCasesPath,
    romPath: defaultRomPath,
    outDir: defaultOutRef,
    limit: null
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--cases' && argv[i + 1]) opts.casesPath = path.resolve(argv[++i]);
    else if (arg === '--rom' && argv[i + 1]) opts.romPath = path.resolve(argv[++i]);
    else if (arg === '--out' && argv[i + 1]) opts.outDir = path.resolve(argv[++i]);
    else if (arg === '--limit' && argv[i + 1]) opts.limit = Number(argv[++i]);
  }
  return opts;
}

function loadReferenceModules() {
  if (typeof globalThis.navigator === 'undefined') {
    globalThis.navigator = { userAgent: '' };
  }
  const requireCjs = createRequire(import.meta.url);
  const config = requireCjs(path.resolve(referenceRepoCache, 'src/config.js'));
  const FMVoice = requireCjs(path.resolve(referenceRepoCache, 'src/voice-dx7.js'));
  const Synth = requireCjs(path.resolve(referenceRepoCache, 'src/synth.js'));
  return { config, FMVoice, Synth };
}

function applyEvent(synth, event) {
  switch (event.type) {
    case 'noteOn':
      synth.noteOn(Number(event.data.note), Number(event.data.velocity ?? 0.8));
      break;
    case 'noteOff':
      synth.noteOff(Number(event.data.note));
      break;
    case 'pitchBend':
      synth.pitchBend(Number(event.data.value ?? 0));
      break;
    case 'modWheel':
      synth.controller(1, Number(event.data.value ?? 0));
      break;
    case 'sustain':
      synth.controller(64, Number(event.data.value ?? 0));
      break;
    case 'panic':
      synth.panic();
      break;
    default:
      throw new Error(`Unsupported event type in reference renderer: ${event.type}`);
  }
}

function configureVoiceEngine(FMVoice, patch, sampleRate, config) {
  config.sampleRate = sampleRate;
  FMVoice.setParams(patch);
  for (let i = 0; i < 6; i += 1) {
    const op = patch.operators[i];
    FMVoice.setOutputLevel(i, op.volume);
    FMVoice.updateFrequency(i);
    FMVoice.setPan(i, op.pan);
  }
  FMVoice.setFeedback(patch.feedback);
  FMVoice.updateLFO();
}

function renderCase(modules, patchCanonical, caseSpec, defaults) {
  const normalized = normalizeCaseEvents(caseSpec, defaults);
  const { sampleRate, totalFrames, events } = normalized;
  const patch = toReferencePatch(patchCanonical);
  const patchCopy = structuredClone(patch);

  configureVoiceEngine(modules.FMVoice, patchCopy, sampleRate, modules.config);
  const synth = new modules.Synth(modules.FMVoice, 16);

  const left = new Float32Array(totalFrames);
  const right = new Float32Array(totalFrames);
  let evIdx = 0;
  for (let frame = 0; frame < totalFrames; frame += 1) {
    while (evIdx < events.length && events[evIdx].frame === frame) {
      applyEvent(synth, events[evIdx]);
      evIdx += 1;
    }
    const [l, r] = synth.render();
    left[frame] = l;
    right[frame] = r;
  }
  return { left, right, sampleRate, totalFrames };
}

function compareBuffers(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function main() {
  const options = parseOptions(process.argv);
  const config = readJson(options.casesPath);
  const defaults = config.defaults ?? {};
  const allCases = Array.isArray(config.cases) ? config.cases : [];
  const cases = options.limit ? allCases.slice(0, options.limit) : allCases;
  const patches = loadPatchLibrary(options.romPath);
  const modules = loadReferenceModules();

  ensureDir(options.outDir);
  const manifest = {
    renderer: 'reference_dx7',
    source: 'mmontag/dx7-synth-js',
    generatedAt: new Date().toISOString(),
    romPath: options.romPath,
    casesPath: options.casesPath,
    cases: []
  };

  for (const caseSpec of cases) {
    const resolved = resolvePatchForCase(patches, caseSpec);
    const { patch, index } = resolved;
    const rendered = renderCase(modules, patch, caseSpec, defaults);
    const outPath = path.resolve(options.outDir, `${caseSpec.id}.wav`);
    writeStereoWav16(outPath, rendered.left, rendered.right, rendered.sampleRate);
    const leftStats = countNonFinite(rendered.left);
    const rightStats = countNonFinite(rendered.right);
    manifest.cases.push({
      id: caseSpec.id,
      group: caseSpec.group,
      algorithm: caseSpec.algorithm,
      patchIndex: index,
      patchName: patch.name,
      patchSource: patch.sourceFile ?? options.romPath,
      patchFallback: !!resolved.fallback,
      wavPath: outPath,
      sha256: sha256File(outPath),
      sampleRate: rendered.sampleRate,
      totalFrames: rendered.totalFrames,
      nonFiniteSamples: leftStats.nonFinite + rightStats.nonFinite,
      maxAbs: Math.max(leftStats.maxAbs, rightStats.maxAbs)
    });
    console.log(`[reference] rendered ${caseSpec.id}${resolved.fallback ? ' (fallback patch)' : ''} -> ${outPath}`);
  }

  if (manifest.cases.length > 0) {
    const first = cases[0];
    const { patch } = resolvePatchForCase(patches, first);
    const runA = renderCase(modules, patch, first, defaults);
    const runB = renderCase(modules, patch, first, defaults);
    manifest.determinism = {
      caseId: first.id,
      leftEqual: compareBuffers(runA.left, runB.left),
      rightEqual: compareBuffers(runA.right, runB.right)
    };
  }

  const manifestPath = path.resolve(options.outDir, 'manifest.json');
  writeJson(manifestPath, manifest);
  console.log(`[reference] manifest -> ${manifestPath}`);
}

main();
