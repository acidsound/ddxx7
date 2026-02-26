import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);
export const ddxx7Root = path.resolve(__dirname, '..', '..');
export const validationRoot = path.resolve(ddxx7Root, 'validation');

export const defaultCasesPath = path.resolve(validationRoot, 'config', 'cases.json');
export const defaultRomPath = path.resolve(ddxx7Root, 'public', 'assets', 'patches');
export const defaultOutRef = path.resolve(validationRoot, 'out', 'ref');
export const defaultOutTest = path.resolve(validationRoot, 'out', 'test');
export const defaultOutAudit = path.resolve(validationRoot, 'out', 'audit');
export const defaultOutAnalysis = path.resolve(validationRoot, 'out', 'analysis');
export const defaultReportsRoot = path.resolve(validationRoot, 'reports');
export const referenceRepoCache = path.resolve(validationRoot, 'cache', 'dx7-synth-js');
export const referenceCommit = 'f269f0e02fc67b2f824b01a8416339cd5c4829e0';
export const referenceRepoUrl = 'https://github.com/mmontag/dx7-synth-js.git';

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

export function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text);
}

export function runCommand(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd ?? ddxx7Root,
    encoding: options.encoding ?? 'utf8',
    stdio: options.stdio ?? 'pipe'
  });
  if (result.status !== 0) {
    const detail = [
      `Command failed: ${cmd} ${args.join(' ')}`,
      `cwd: ${options.cwd ?? ddxx7Root}`,
      result.stdout ? `stdout:\n${result.stdout}` : '',
      result.stderr ? `stderr:\n${result.stderr}` : ''
    ].filter(Boolean).join('\n\n');
    throw new Error(detail);
  }
  return result;
}

export function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

export function nowTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

export function loadAlgorithmsFromTs(tsPath = path.resolve(ddxx7Root, 'services', 'algorithms.ts')) {
  const src = fs.readFileSync(tsPath, 'utf8');
  const match = src.match(/export const ALGORITHMS[^=]*=\s*(\[[\s\S]*\]);/);
  if (!match) {
    throw new Error(`Unable to parse ALGORITHMS array from ${tsPath}`);
  }
  const literal = match[1];
  const algorithms = Function(`"use strict"; return (${literal});`)();
  if (!Array.isArray(algorithms)) {
    throw new Error('Parsed algorithms is not an array');
  }
  return algorithms;
}

export function normalizeCaseEvents(caseSpec, defaults = {}) {
  const sampleRate = caseSpec.sampleRate ?? defaults.sampleRate ?? 44100;
  const durationSeconds = caseSpec.durationSeconds ?? defaults.durationSeconds ?? 2.5;
  const totalFrames = Math.max(1, Math.round(durationSeconds * sampleRate));
  const events = (caseSpec.events ?? []).map((ev, index) => {
    const timeSeconds = Number(ev.timeSeconds ?? 0);
    const rawFrame = Math.round(timeSeconds * sampleRate);
    return {
      index,
      timeSeconds,
      frame: Math.max(0, Math.min(totalFrames - 1, rawFrame)),
      type: ev.type,
      data: ev.data ?? {}
    };
  }).sort((a, b) => (a.frame - b.frame) || (a.index - b.index));

  return { sampleRate, durationSeconds, totalFrames, events };
}

export function writeStereoWav16(outPath, left, right, sampleRate) {
  if (left.length !== right.length) {
    throw new Error(`Channel length mismatch: left=${left.length} right=${right.length}`);
  }
  const frames = left.length;
  const channels = 2;
  const bitsPerSample = 16;
  const blockAlign = channels * bitsPerSample / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = frames * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < frames; i += 1) {
    const l = Math.max(-1, Math.min(1, Number.isFinite(left[i]) ? left[i] : 0));
    const r = Math.max(-1, Math.min(1, Number.isFinite(right[i]) ? right[i] : 0));
    buffer.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    buffer.writeInt16LE(Math.round(r * 32767), 44 + i * 4 + 2);
  }

  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, buffer);
}

export function countNonFinite(samples) {
  let nonFinite = 0;
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i];
    if (!Number.isFinite(value)) {
      nonFinite += 1;
      continue;
    }
    const abs = Math.abs(value);
    if (abs > maxAbs) maxAbs = abs;
  }
  return { nonFinite, maxAbs };
}
