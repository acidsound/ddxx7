import fs from 'node:fs';
import path from 'node:path';

import {
  ddxx7Root,
  defaultOutAnalysis,
  defaultOutRef,
  defaultOutTest,
  ensureDir,
  readJson,
  runCommand,
  writeJson
} from './common.mjs';

function parseOptions(argv) {
  const opts = {
    refManifest: path.resolve(defaultOutRef, 'manifest.json'),
    testManifest: path.resolve(defaultOutTest, 'manifest.json'),
    outDir: defaultOutAnalysis,
    limit: null
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--ref-manifest' && argv[i + 1]) opts.refManifest = path.resolve(argv[++i]);
    else if (arg === '--test-manifest' && argv[i + 1]) opts.testManifest = path.resolve(argv[++i]);
    else if (arg === '--out' && argv[i + 1]) opts.outDir = path.resolve(argv[++i]);
    else if (arg === '--limit' && argv[i + 1]) opts.limit = Number(argv[++i]);
  }
  return opts;
}

function mapById(items) {
  const map = new Map();
  items.forEach((item) => map.set(item.id, item));
  return map;
}

function main() {
  const options = parseOptions(process.argv);
  const ref = readJson(options.refManifest);
  const test = readJson(options.testManifest);
  const refMap = mapById(ref.cases ?? []);
  const testMap = mapById(test.cases ?? []);
  const root = path.resolve(ddxx7Root, '..');
  const quickScript = path.resolve(root, 'skills', 'audio-ear', 'scripts', 'ffmpeg_sox_quick_compare.py');
  const detailScript = path.resolve(root, 'skills', 'audio-ear', 'scripts', 'wav_ear_compare.py');

  ensureDir(options.outDir);
  const caseIds = (ref.cases ?? [])
    .map((entry) => entry.id)
    .filter((id) => testMap.has(id));
  const selectedIds = options.limit ? caseIds.slice(0, options.limit) : caseIds;

  const manifest = {
    generatedAt: new Date().toISOString(),
    refManifest: options.refManifest,
    testManifest: options.testManifest,
    quickScript,
    detailScript,
    cases: []
  };

  for (const caseId of selectedIds) {
    const refCase = refMap.get(caseId);
    const testCase = testMap.get(caseId);
    const caseDir = path.resolve(options.outDir, 'cases', caseId);
    ensureDir(caseDir);
    const quickJson = path.resolve(caseDir, 'quick.json');
    const quickMd = path.resolve(caseDir, 'quick.md');
    const detailJson = path.resolve(caseDir, 'detail.json');
    const detailMd = path.resolve(caseDir, 'detail.md');

    runCommand('python3', [
      quickScript,
      '--ref', refCase.wavPath,
      '--test', testCase.wavPath,
      '--json-out', quickJson,
      '--md-out', quickMd,
      '--title', `Quick Compare - ${caseId}`
    ]);

    runCommand('python3', [
      detailScript,
      '--ref', refCase.wavPath,
      '--test', testCase.wavPath,
      '--json-out', detailJson,
      '--md-out', detailMd,
      '--max-seconds', '2.5',
      '--fft-size', '2048',
      '--hop-size', '512',
      '--title', `Detailed Compare - ${caseId}`
    ]);

    const detail = readJson(detailJson);
    const difference = detail.difference ?? {};
    const suggestions = Array.isArray(detail.suggestions) ? detail.suggestions : [];
    const suggestionFocuses = suggestions
      .map((item) => item.focus)
      .filter((focus) => typeof focus === 'string');

    manifest.cases.push({
      id: caseId,
      group: refCase.group,
      algorithm: refCase.algorithm,
      reference: refCase.wavPath,
      test: testCase.wavPath,
      quickJson,
      quickMd,
      detailJson,
      detailMd,
      difference,
      suggestionFocuses,
      nonFiniteSamples: {
        reference: refCase.nonFiniteSamples ?? 0,
        test: testCase.nonFiniteSamples ?? 0
      }
    });

    console.log(`[analysis] compared ${caseId}`);
  }

  const manifestPath = path.resolve(options.outDir, 'manifest.json');
  writeJson(manifestPath, manifest);
  console.log(`[analysis] manifest -> ${manifestPath}`);
}

main();

