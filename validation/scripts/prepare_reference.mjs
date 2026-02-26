import fs from 'node:fs';
import path from 'node:path';

import {
  ddxx7Root,
  ensureDir,
  referenceCommit,
  referenceRepoCache,
  referenceRepoUrl,
  runCommand,
  validationRoot,
  writeJson
} from './common.mjs';

function ensureReferenceRepo() {
  ensureDir(path.dirname(referenceRepoCache));
  if (!fs.existsSync(referenceRepoCache)) {
    runCommand('git', ['clone', referenceRepoUrl, referenceRepoCache], {
      cwd: validationRoot,
      stdio: 'inherit'
    });
  }

  runCommand('git', ['fetch', '--tags', 'origin'], { cwd: referenceRepoCache, stdio: 'inherit' });
  runCommand('git', ['fetch', 'origin', referenceCommit], { cwd: referenceRepoCache, stdio: 'inherit' });
  runCommand('git', ['checkout', '--detach', referenceCommit], {
    cwd: referenceRepoCache,
    stdio: 'inherit'
  });

  const head = runCommand('git', ['rev-parse', 'HEAD'], { cwd: referenceRepoCache }).stdout.trim();
  if (head !== referenceCommit) {
    throw new Error(`Reference commit mismatch. expected=${referenceCommit} actual=${head}`);
  }
}

function ensurePlaywrightChromium() {
  runCommand(
    'npx',
    ['--yes', '-p', 'playwright', 'playwright', 'install', 'chromium'],
    { cwd: ddxx7Root, stdio: 'inherit' }
  );
}

function main() {
  ensureReferenceRepo();
  ensurePlaywrightChromium();

  writeJson(path.resolve(validationRoot, 'cache', 'reference-info.json'), {
    repoUrl: referenceRepoUrl,
    commit: referenceCommit,
    checkedAt: new Date().toISOString(),
    localPath: referenceRepoCache
  });

  console.log(`Prepared reference repository at ${referenceRepoCache}`);
}

main();

