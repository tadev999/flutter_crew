'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { TRACE_KINDS, DRAFT_MARKER } = require('../constants');
const { hashFile, listFiles, read, resolveProjectFile, writeFileAtomic, writeJsonAtomic } = require('../fsutil');
const { validateTrace } = require('../spec');
const { snapshot, requirementSnapshot, specStatus, buildReport, criteriaFor } = require('../report');
const { gitDirty } = require('../modeguard');
const { parseArgs, listOption } = require('./args');

/** Record a per-requirement trace: links to real implementation/test/evidence files. */
function trace(ctx, args) {
  const { root, store } = ctx;
  const parsed = parseArgs(args);
  if (parsed.flags.has('--auto')) return autoTrace(ctx, parsed);
  const manifest = store.load();
  const spec = specStatus(root, manifest);
  if (spec.issues.length) throw new Error(spec.issues.join('\n'));

  const [id, reportPath] = parsed.positional;
  const requirement = spec.requirements.find((entry) => entry.id === id);
  if (!requirement) throw new Error(`Unknown requirement ID: ${id}`);

  const report = resolveProjectFile(root, reportPath);
  if (report === store.realPath()) throw new Error('Run state is not a trace report.');
  const value = validateTrace(JSON.parse(read(report)), requirement);

  const references = [];
  if (value.status === 'passed') {
    const forbidden = [report, store.realPath(), resolveProjectFile(root, manifest.spec.path),
      resolveProjectFile(root, manifest.requirements)];
    for (const kind of TRACE_KINDS) {
      for (const relative of value[kind]) {
        const referenced = resolveProjectFile(root, relative);
        if (forbidden.includes(referenced) || !read(referenced).trim()) {
          throw new Error('Trace references must be non-empty implementation/test/evidence files, not the brief, spec, report or run state.');
        }
        references.push({ kind, evidence: relative, hash: hashFile(referenced) });
      }
    }
  }

  manifest.traceability[id] = {
    status: value.status, notes: value.notes || '', evidence: reportPath, hash: hashFile(report),
    references, testRationale: value.testRationale || '', at: new Date().toISOString()
  };
  manifest.traceability[id].snapshot = snapshot(root, manifest);
  // Per-requirement freshness: only this requirement's files + shared inputs invalidate it.
  manifest.traceability[id].scopeSnapshot = requirementSnapshot(root, manifest, id);
  manifest.status = 'in_progress';
  store.save(manifest);
  console.log(`Recorded ${id}: ${value.status}. Artifact links do not prove test execution or semantic coverage.`);
  return manifest;
}

const nonEmpty = (root, relative) => {
  try { return !!read(resolveProjectFile(root, relative)).trim(); } catch { return false; }
};

/**
 * trace --auto <REQ-ID> [--impl=a,b] [--tests=a,b]
 * Builds the trace report from facts instead of hand-written JSON:
 *  - implementation: --impl, else uncommitted lib/*.dart files (git)
 *  - tests: --tests, else test files whose content mentions the REQ id
 *  - evidence: generated from the current passing verify run
 * Requires a current passing `verify`; it still records links, not proof of semantic coverage.
 */
function autoTrace(ctx, { positional, options }) {
  const { root, store } = ctx;
  const manifest = store.load();
  const spec = specStatus(root, manifest);
  if (spec.issues.length) throw new Error(spec.issues.join('\n'));
  const [id] = positional;
  const requirement = spec.requirements.find((entry) => entry.id === id);
  if (!requirement) throw new Error(`Unknown requirement ID: ${id}`);

  const report = buildReport(root, manifest).report;
  if (!report.verificationStatus.valid) {
    throw new Error('trace --auto needs a current passing verify. Run verify first, then trace --auto.');
  }

  let implementation = listOption(options.impl);
  if (!implementation.length) {
    const dirty = gitDirty(root);
    if (!dirty) throw new Error('No git history to infer implementation files. Pass --impl=lib/a.dart,lib/b.dart.');
    implementation = [...dirty].filter((file) => /^lib\/.+\.dart$/.test(file)).sort();
  }
  implementation = implementation.filter((file) => nonEmpty(root, file));
  if (!implementation.length) throw new Error('No implementation files found. Pass --impl=lib/a.dart,lib/b.dart.');

  let tests = listOption(options.tests);
  if (!tests.length) {
    tests = ['test', 'integration_test'].flatMap((dir) => listFiles(path.join(root, dir)))
      .filter((file) => file.endsWith('.dart') && read(file).includes(id))
      .map((file) => path.relative(root, file).split(path.sep).join('/')).sort();
  }
  tests = tests.filter((file) => nonEmpty(root, file));
  if (!tests.length && requirement.verification === 'automated') {
    throw new Error(`No test file mentions ${id}. Put "${id}" in a test/group name, or pass --tests=test/x_test.dart.`);
  }

  const evidenceFile = `.fluttercrew/evidence/${id}.auto.md`;
  const lines = [
    `# ${id} — auto-generated evidence`, '',
    `Generated ${new Date().toISOString()} from the current passing verify run.`, '',
    `**Requirement:** ${requirement.description}`, '', '**Acceptance criteria:**',
    ...requirement.acceptanceCriteria.map((item) => `- ${item}`), '',
    '**Verification gates (recorded run):**',
    ...(manifest.verification?.checks || []).map((check) => `- ${check.name}: ${check.passed ? 'PASSED' : 'FAILED'} (log: ${check.log})`), '',
    '**Implementation files:**', ...implementation.map((file) => `- ${file}`), '',
    '**Test files mentioning this requirement:**', ...(tests.length ? tests.map((file) => `- ${file}`) : ['- (manual verification)']), '',
    'Limits: file links come from git/--impl and a text match of the requirement ID. The full test suite',
    'ran in the verify gate; per-requirement test execution is not individually proven.'
  ];
  writeFileAtomic(path.join(root, evidenceFile), `${lines.join('\n')}\n`);

  const traceFile = `.fluttercrew/traces/${id}.json`;
  writeJsonAtomic(path.join(root, traceFile), {
    status: 'passed', notes: 'Auto-generated by trace --auto from a passing verify run.',
    implementation, tests, evidence: [evidenceFile],
    ...(requirement.verification === 'manual' && !tests.length
      ? { testRationale: 'Manual verification requirement; see the reviewed evidence report.' } : {})
  });
  return trace(ctx, [id, traceFile]);
}

/** Draft evidence skeletons: facts pre-filled, judgement left for the reviewer. */
const REVIEW_PROMPTS = {
  requirements: ['Map every acceptance criterion to code and tests, with actual pass/block status.',
    'Confirm no feature in the original brief was omitted or weakened.'],
  design: ['Visual concept and design tokens used (colors, type, spacing).',
    'Accessibility decisions (contrast, labels, >=48 touch targets, reduced motion).',
    'Loading / empty / error / offline states and how each looks.'],
  backend: ['Target (emulator / cloud project) and exact commands executed.',
    'Round-trip result (write then read back).',
    'Negative authorization results (another user / anonymous must be denied).',
    'For backend "none": state explicitly that there is no remote scope.'],
  security: ['Reviewer findings and how each was resolved.',
    'Secrets handling (none in source, logs or chat) and secure storage use.',
    'Remaining risk, stated honestly.'],
  experience: ['Critical user journey you actually ran: device/emulator and viewport.',
    'States exercised (loading, empty, error, offline) and what you observed.',
    'Do not describe anything you did not run.']
};

function writeDraft(ctx, criterion) {
  const { root, store } = ctx;
  const manifest = store.load();
  if (!criteriaFor(manifest).includes(criterion)) {
    throw new Error(`Criterion must be: ${criteriaFor(manifest).join(', ')}`);
  }
  const relative = `.fluttercrew/evidence/${criterion}.md`;
  const file = path.join(root, relative);
  if (fs.existsSync(file)) {
    console.log(`Draft not written: ${relative} already exists. Review/edit it, then: accept ${criterion} ${relative}`);
    return manifest;
  }
  const report = buildReport(root, manifest).report;
  const lines = [
    `<!-- ${DRAFT_MARKER}: replace the prompts with real observations, then DELETE this line. accept rejects drafts. -->`,
    `# ${criterion} review`, '',
    `Mode: ${report.mode} · Backend: ${report.backend} · Spec revision: ${report.spec?.revision ?? 'n/a'}`, '',
    '## Facts from the run (auto-filled)', '',
    ...report.requirementStatus.map((entry) => `- ${entry.id} [${entry.status}] ${entry.description}` +
      (entry.references.length ? `\n  - links: ${entry.references.map((ref) => ref.evidence).join(', ')}` : '')),
    '',
    ...(report.verification?.checks || []).map((check) => `- gate ${check.name}: ${check.passed ? 'PASSED' : 'FAILED'} (${check.log})`),
    ...(report.preflightSuppressed || []).map((entry) => `- preflight rule "${entry.rule}" suppressed: ${entry.reason}`),
    '', '## Reviewer must fill in', '',
    ...REVIEW_PROMPTS[criterion].map((item) => `- ${item}\n  - _TODO_`), ''
  ];
  writeFileAtomic(file, lines.join('\n'));
  console.log(`Draft created: ${relative}. Fill it with real observations, remove the draft line, then: accept ${criterion} ${relative}`);
  return manifest;
}

/** Record one of the global review attestations backed by a reviewed evidence report. */
function accept(ctx, args) {
  const { root, store } = ctx;
  const { positional, flags } = parseArgs(args);
  const manifest = store.load();
  const required = criteriaFor(manifest);
  if (flags.has('--draft')) return writeDraft(ctx, positional[0]);
  const [id, evidence] = positional;
  if (!required.includes(id)) throw new Error(`Criterion must be: ${required.join(', ')}`);
  const file = resolveProjectFile(root, evidence);
  if (file === store.realPath()) throw new Error('Run state is not evidence.');
  const content = read(file);
  if (!content.trim()) throw new Error('Empty evidence is not accepted.');
  if (content.includes(DRAFT_MARKER)) {
    throw new Error('Evidence is still an unreviewed draft. Fill in real observations and remove the draft line first.');
  }
  manifest.acceptance[id] = {
    evidence, hash: hashFile(file), snapshot: snapshot(root, manifest), at: new Date().toISOString()
  };
  manifest.status = 'in_progress';
  store.save(manifest);
  console.log(`Recorded ${id} attestation. Evidence content still requires reviewer judgement.`);
  return manifest;
}

module.exports = { trace, accept };
