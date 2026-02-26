import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { chromium } from 'playwright';

import {
  defaultCasesPath,
  defaultOutTest,
  defaultRomPath,
  ddxx7Root,
  ensureDir,
  loadAlgorithmsFromTs,
  normalizeCaseEvents,
  readJson,
  sha256File,
  writeJson
} from './common.mjs';
import {
  loadPatchLibrary,
  resolvePatchForCase,
  toDdxxPatch
} from './parse_syx.mjs';

function parseOptions(argv) {
  const opts = {
    casesPath: defaultCasesPath,
    romPath: defaultRomPath,
    outDir: defaultOutTest,
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

function contentType(filePath) {
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.wav')) return 'audio/wav';
  if (filePath.endsWith('.syx')) return 'application/octet-stream';
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'application/octet-stream';
}

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqPath = new URL(req.url, 'http://127.0.0.1').pathname;
      const normalized = reqPath === '/' ? '/index.html' : reqPath;
      const absPath = path.resolve(rootDir, `.${normalized}`);
      if (!absPath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const data = fs.readFileSync(absPath);
      res.writeHead(200, { 'Content-Type': contentType(absPath) });
      res.end(data);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        origin: `http://127.0.0.1:${addr.port}`
      });
    });
  });
}

async function renderCaseInBrowser(page, payload) {
  return page.evaluate(async (args) => {
    const {
      moduleUrl,
      algorithms,
      patch,
      events,
      sampleRate,
      totalFrames,
      cacheBust
    } = args;

    function writeString(view, offset, text) {
      for (let i = 0; i < text.length; i += 1) {
        view.setUint8(offset + i, text.charCodeAt(i));
      }
    }

    function encodeWav16(left, right, sr) {
      const frames = left.length;
      const blockAlign = 4;
      const dataSize = frames * blockAlign;
      const buf = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buf);
      writeString(view, 0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeString(view, 8, 'WAVE');
      writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 2, true);
      view.setUint32(24, sr, true);
      view.setUint32(28, sr * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, 16, true);
      writeString(view, 36, 'data');
      view.setUint32(40, dataSize, true);

      let nonFinite = 0;
      let maxAbs = 0;
      let offset = 44;
      for (let i = 0; i < frames; i += 1) {
        let l = left[i];
        let r = right[i];
        if (!Number.isFinite(l)) {
          l = 0;
          nonFinite += 1;
        }
        if (!Number.isFinite(r)) {
          r = 0;
          nonFinite += 1;
        }
        const lAbs = Math.abs(l);
        const rAbs = Math.abs(r);
        if (lAbs > maxAbs) maxAbs = lAbs;
        if (rAbs > maxAbs) maxAbs = rAbs;
        const lClamped = Math.max(-1, Math.min(1, l));
        const rClamped = Math.max(-1, Math.min(1, r));
        view.setInt16(offset, Math.round(lClamped * 32767), true);
        view.setInt16(offset + 2, Math.round(rClamped * 32767), true);
        offset += 4;
      }
      return { bytes: new Uint8Array(buf), nonFinite, maxAbs };
    }

    function toBase64(bytes) {
      const chunkSize = 0x8000;
      let binary = '';
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const slice = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...slice);
      }
      return btoa(binary);
    }

    const ctx = new OfflineAudioContext(2, totalFrames, sampleRate);
    await ctx.audioWorklet.addModule(`${moduleUrl}?v=${cacheBust}`);
    const node = new AudioWorkletNode(ctx, 'dx7-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });
    node.connect(ctx.destination);
    node.port.postMessage({ type: 'init', algorithms });
    node.port.postMessage({ type: 'patch', data: patch });
    node.port.postMessage({ type: 'scheduleEvents', data: events });

    const rendered = await ctx.startRendering();
    const left = rendered.getChannelData(0);
    const right = rendered.getChannelData(1);
    const wav = encodeWav16(left, right, sampleRate);
    return {
      wavBase64: toBase64(wav.bytes),
      nonFiniteSamples: wav.nonFinite,
      maxAbs: wav.maxAbs
    };
  }, payload);
}

async function main() {
  const options = parseOptions(process.argv);
  const caseConfig = readJson(options.casesPath);
  const defaults = caseConfig.defaults ?? {};
  const allCases = Array.isArray(caseConfig.cases) ? caseConfig.cases : [];
  const cases = options.limit ? allCases.slice(0, options.limit) : allCases;

  const patches = loadPatchLibrary(options.romPath);
  const algorithms = loadAlgorithmsFromTs();
  ensureDir(options.outDir);

  const publicRoot = path.resolve(ddxx7Root, 'public');
  const { server, origin } = await startStaticServer(publicRoot);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });

  const manifest = {
    renderer: 'ddxx7_audio_worklet_offline',
    generatedAt: new Date().toISOString(),
    romPath: options.romPath,
    casesPath: options.casesPath,
    cases: []
  };

  try {
    for (const caseSpec of cases) {
      const normalized = normalizeCaseEvents(caseSpec, defaults);
      const resolved = resolvePatchForCase(patches, caseSpec);
      const { patch, index } = resolved;
      const ddxxPatch = toDdxxPatch(patch);
      const result = await renderCaseInBrowser(page, {
        moduleUrl: `${origin}/dx7-processor.js`,
        cacheBust: `${caseSpec.id}_${Date.now()}`,
        algorithms,
        patch: ddxxPatch,
        events: normalized.events.map((ev) => ({
          frame: ev.frame,
          type: ev.type,
          data: ev.data
        })),
        sampleRate: normalized.sampleRate,
        totalFrames: normalized.totalFrames
      });
      const wavPath = path.resolve(options.outDir, `${caseSpec.id}.wav`);
      fs.writeFileSync(wavPath, Buffer.from(result.wavBase64, 'base64'));
      manifest.cases.push({
        id: caseSpec.id,
        group: caseSpec.group,
        algorithm: caseSpec.algorithm,
        patchIndex: index,
        patchName: patch.name,
        patchSource: patch.sourceFile ?? options.romPath,
        patchFallback: !!resolved.fallback,
        wavPath,
        sha256: sha256File(wavPath),
        sampleRate: normalized.sampleRate,
        totalFrames: normalized.totalFrames,
        nonFiniteSamples: result.nonFiniteSamples,
        maxAbs: result.maxAbs
      });
      console.log(`[ddxx7] rendered ${caseSpec.id}${resolved.fallback ? ' (fallback patch)' : ''} -> ${wavPath}`);
    }

    if (cases.length > 0) {
      const firstCase = cases[0];
      const normalized = normalizeCaseEvents(firstCase, defaults);
      const { patch } = resolvePatchForCase(patches, firstCase);
      const payload = {
        moduleUrl: `${origin}/dx7-processor.js`,
        algorithms,
        patch: toDdxxPatch(patch),
        events: normalized.events.map((ev) => ({
          frame: ev.frame,
          type: ev.type,
          data: ev.data
        })),
        sampleRate: normalized.sampleRate,
        totalFrames: normalized.totalFrames
      };
      const runA = await renderCaseInBrowser(page, { ...payload, cacheBust: `detA_${Date.now()}` });
      const runB = await renderCaseInBrowser(page, { ...payload, cacheBust: `detB_${Date.now()}` });
      manifest.determinism = {
        caseId: firstCase.id,
        equal: runA.wavBase64 === runB.wavBase64
      };
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  const manifestPath = path.resolve(options.outDir, 'manifest.json');
  writeJson(manifestPath, manifest);
  console.log(`[ddxx7] manifest -> ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
