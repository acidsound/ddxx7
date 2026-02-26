import fs from 'node:fs';
import path from 'node:path';

import {
  ddxx7Root,
  defaultOutAudit,
  ensureDir,
  loadAlgorithmsFromTs,
  referenceRepoCache,
  writeJson,
  writeText
} from './common.mjs';

function auditAlgorithms(algorithms) {
  const invalidEntries = [];
  const invalidIndices = [];

  algorithms.forEach((alg, idx) => {
    if (!alg || !Array.isArray(alg.outputMix) || !Array.isArray(alg.modulationMatrix)) {
      invalidEntries.push({ algorithm: idx + 1, reason: 'Missing outputMix/modulationMatrix' });
      return;
    }
    if (alg.modulationMatrix.length !== 6) {
      invalidEntries.push({
        algorithm: idx + 1,
        reason: `modulationMatrix length ${alg.modulationMatrix.length} (expected 6)`
      });
    }
    alg.outputMix.forEach((opIdx) => {
      if (!Number.isInteger(opIdx) || opIdx < 0 || opIdx > 5) {
        invalidIndices.push({ algorithm: idx + 1, field: 'outputMix', value: opIdx });
      }
    });
    alg.modulationMatrix.forEach((row, carrier) => {
      if (!Array.isArray(row)) {
        invalidEntries.push({ algorithm: idx + 1, reason: `modulationMatrix[${carrier}] is not an array` });
        return;
      }
      row.forEach((mod) => {
        if (!Number.isInteger(mod) || mod < 0 || mod > 5) {
          invalidIndices.push({
            algorithm: idx + 1,
            field: `modulationMatrix[${carrier}]`,
            value: mod
          });
        }
      });
    });
  });

  return {
    count: algorithms.length,
    invalidEntries,
    invalidIndices
  };
}

function parseOutputLevelTableLength(processorSource) {
  const match = processorSource.match(/const OUTPUT_LEVEL_TABLE = \[([\s\S]*?)\];/);
  if (!match) return null;
  const items = match[1]
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  return items.length;
}

function main() {
  const algorithms = loadAlgorithmsFromTs();
  const algorithmAudit = auditAlgorithms(algorithms);
  const processorPath = path.resolve(ddxx7Root, 'public', 'dx7-processor.js');
  const processorSource = fs.readFileSync(processorPath, 'utf8');

  const formulaChecks = {
    feedbackFormula: /Math\.pow\(2,\s*this\.patch\.feedback\s*-\s*7\)/.test(processorSource),
    ratioFrequencyFormula: /\(op\.freqCoarse\s*\|\|\s*0\.5\)\s*\*\s*\(1\s*\+\s*op\.freqFine\s*\/\s*100\)/.test(
      processorSource
    ),
    fixedFrequencyFormula: /Math\.pow\(10,\s*op\.freqCoarse\s*%\s*4\)\s*\*\s*\(1\s*\+\s*\(op\.freqFine\s*\/\s*99\)\s*\*\s*8\.772\)/.test(
      processorSource
    ),
    outputLevelTableLength: parseOutputLevelTableLength(processorSource),
    envelopeDivisor: /const divisor = 8192 \* \(SAMPLE_RATE \/ 44100\);/.test(processorSource),
    keyboardRateScaling: /const rBoost = Math\.floor\(this\.keyScaleRate \* noteOffset \/ 8\);/.test(processorSource)
  };

  const deviations = [];
  const referenceEnvelopePath = path.resolve(referenceRepoCache, 'src', 'envelope-dx7.js');
  if (fs.existsSync(referenceEnvelopePath)) {
    const referenceEnvelope = fs.readFileSync(referenceEnvelopePath, 'utf8');
    const referenceUses2048 = /\/\s*2048/.test(referenceEnvelope);
    const referenceRateScalingZero = /var rate_scaling = 0;/.test(referenceEnvelope);

    if (formulaChecks.envelopeDivisor && referenceUses2048) {
      deviations.push({
        id: 'envelope_divisor_8192_vs_2048',
        category: 'envelope',
        ddxx7: '8192 * (SAMPLE_RATE / 44100)',
        reference: '2048',
        impact: 'DDXX7 envelope progression is slower than reference.'
      });
    }
    if (formulaChecks.keyboardRateScaling && referenceRateScalingZero) {
      deviations.push({
        id: 'keyboard_rate_scaling_enabled',
        category: 'envelope',
        ddxx7: 'Key-rate scaling applied via rBoost.',
        reference: 'rate_scaling fixed at 0.',
        impact: 'Higher notes may decay faster than reference.'
      });
    }
  } else {
    deviations.push({
      id: 'reference_repo_missing',
      category: 'setup',
      ddxx7: 'N/A',
      reference: 'N/A',
      impact: 'Reference envelope file was not found; run validate:fm:prepare first.'
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    files: {
      algorithms: path.resolve(ddxx7Root, 'services', 'algorithms.ts'),
      processor: processorPath,
      referenceEnvelope: referenceEnvelopePath
    },
    algorithmAudit,
    formulaChecks,
    deviations
  };

  ensureDir(defaultOutAudit);
  const jsonPath = path.resolve(defaultOutAudit, 'audit.json');
  writeJson(jsonPath, report);

  const md = [
    '# DDXX7 FM Static Audit',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Algorithm entries: ${algorithmAudit.count}`,
    `- Invalid algorithm entries: ${algorithmAudit.invalidEntries.length}`,
    `- Invalid operator indices: ${algorithmAudit.invalidIndices.length}`,
    '',
    '## Formula Checks',
    '',
    `- Feedback formula \`2^(fb-7)\`: ${formulaChecks.feedbackFormula ? 'PASS' : 'FAIL'}`,
    `- Ratio frequency formula: ${formulaChecks.ratioFrequencyFormula ? 'PASS' : 'FAIL'}`,
    `- Fixed frequency formula: ${formulaChecks.fixedFrequencyFormula ? 'PASS' : 'FAIL'}`,
    `- Output level table length: ${formulaChecks.outputLevelTableLength}`,
    `- Envelope divisor expression (8192): ${formulaChecks.envelopeDivisor ? 'FOUND' : 'NOT FOUND'}`,
    `- Keyboard rate scaling expression: ${formulaChecks.keyboardRateScaling ? 'FOUND' : 'NOT FOUND'}`,
    '',
    '## Deviations',
    ''
  ];

  if (deviations.length === 0) {
    md.push('- No explicit deviation detected.');
  } else {
    deviations.forEach((item, idx) => {
      md.push(`${idx + 1}. **${item.id}**`);
      md.push(`   - DDXX7: ${item.ddxx7}`);
      md.push(`   - Reference: ${item.reference}`);
      md.push(`   - Impact: ${item.impact}`);
    });
  }

  const mdPath = path.resolve(defaultOutAudit, 'audit.md');
  writeText(mdPath, `${md.join('\n')}\n`);
  console.log(`[audit] json -> ${jsonPath}`);
  console.log(`[audit] md   -> ${mdPath}`);
}

main();

