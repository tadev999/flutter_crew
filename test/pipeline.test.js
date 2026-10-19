'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { derivePipeline, scanSignals } = require('../.agents/runtime/pipeline');
const { generateDashboardHtml } = require('../.agents/runtime/dashboard');

const T0 = Date.parse('2026-01-01T10:00:00Z');
const iso = (offsetSec) => new Date(T0 + offsetSec * 1000).toISOString();

function base(extra = {}) {
  return {
    status: 'in_progress', requirements: 'docs/request.md', backend: 'none', startedAt: iso(0),
    spec: { at: iso(10), revision: 1, ids: ['REQ-1', 'REQ-2'] },
    requirementStatus: [
      { id: 'REQ-1', status: 'pending', acceptanceCriteria: ['a'], references: [] },
      { id: 'REQ-2', status: 'pending', acceptanceCriteria: ['b'], references: [] }
    ],
    approvalStatus: { valid: !!extra.approved, status: extra.approved ? 'valid' : 'missing' },
    verificationStatus: {
      valid: !!extra.verification?.passed && !extra.sourceChangedSinceVerification,
      status: !extra.verification ? 'missing' : (extra.sourceChangedSinceVerification ? 'stale'
        : (extra.verification.passed ? 'valid' : 'failed')),
      checks: (extra.verification?.checks || []).map((check) => ({
        name: check.name, status: extra.sourceChangedSinceVerification ? 'stale' : (check.passed ? 'passed' : 'failed')
      }))
    },
    traceability: {}, acceptance: {}, verification: null, missingOrStaleCriteria: [], ...extra
  };
}
const statuses = (p) => p.stages.map((s) => s.status);
const none = { lib: { total: 5, changed: 0, changedFiles: [] }, test: { total: 1, changed: 0, changedFiles: [] } };

test('no run: only intake is active', () => {
  const p = derivePipeline({ status: 'not_started', requirements: null, requirementStatus: [] }, none);
  assert.deepEqual(statuses(p), ['active', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending']);
});

test('spec baselined but not approved: approval is the active gate', () => {
  const p = derivePipeline(base(), none);
  assert.deepEqual(statuses(p), ['completed', 'completed', 'active', 'pending', 'pending', 'pending', 'pending']);
});

test('stale approval does not complete the runtime approval gate', () => {
  const p = derivePipeline(base({ approved: { at: iso(20), notes: 'unbound' },
    approvalStatus: { valid: false, status: 'stale' } }), none);
  assert.equal(p.stages[2].status, 'active');
  assert.equal(p.stages[3].status, 'pending');
  assert.ok(p.approvalStale);
});

test('approved: implementation active while no files changed', () => {
  const p = derivePipeline(base({ approved: { at: iso(20), notes: 'ok' } }), none);
  assert.deepEqual(statuses(p), ['completed', 'completed', 'completed', 'active', 'pending', 'pending', 'pending']);
});

test('lib edits keep implementation active (no early completion)', () => {
  const sig = { ...none, lib: { total: 5, changed: 3, changedFiles: ['a.dart'], latest: T0 } };
  const p = derivePipeline(base({ approved: { at: iso(20) } }), sig);
  assert.equal(p.stages[3].status, 'active');
  assert.equal(p.stages[4].status, 'pending');
});

test('first test file does not complete implementation or start testing', () => {
  const sig = { lib: { total: 5, changed: 3, changedFiles: [] }, test: { total: 2, changed: 1, changedFiles: ['x_test.dart'], latest: T0 } };
  const p = derivePipeline(base({ approved: { at: iso(20) } }), sig);
  assert.deepEqual(statuses(p), ['completed', 'completed', 'completed', 'active', 'pending', 'pending', 'pending']);
});

test('all requirements traced passed moves on to quality gates', () => {
  const report = base({
    approved: { at: iso(20) },
    traceability: { 'REQ-1': {}, 'REQ-2': {} },
    requirementStatus: base().requirementStatus.map((r) => ({ ...r, status: 'passed' }))
  });
  const p = derivePipeline(report, none);
  assert.deepEqual(statuses(p), ['completed', 'completed', 'completed', 'completed', 'completed', 'active', 'pending']);
});

test('failed verification marks quality gates failed, never later stages done', () => {
  const report = base({
    approved: { at: iso(20) }, traceability: { 'REQ-1': {}, 'REQ-2': {} },
    requirementStatus: base().requirementStatus.map((r) => ({ ...r, status: 'passed' })),
    verification: { passed: false, at: iso(60), checks: [{ name: 'format', passed: true }, { name: 'analyze', passed: false, log: 'x' }] }
  });
  const p = derivePipeline(report, none);
  assert.equal(p.stages[5].status, 'failed');
  assert.equal(p.stages[6].status, 'pending');
});

test('verified: acceptance becomes active, then done on finish', () => {
  const verified = base({
    approved: { at: iso(20) }, traceability: { 'REQ-1': {}, 'REQ-2': {} },
    requirementStatus: base().requirementStatus.map((r) => ({ ...r, status: 'passed' })),
    verification: { passed: true, at: iso(60), checks: [{ name: 'format', passed: true }, { name: 'analyze', passed: true }, { name: 'tests', passed: true }] },
    sourceChangedSinceVerification: false
  });
  const active = derivePipeline(verified, none);
  assert.equal(active.stages[5].status, 'completed');
  assert.equal(active.stages[6].status, 'active');
  const done = derivePipeline({ ...verified, status: 'done' }, none);
  assert.ok(done.stages.every((s) => s.status === 'completed'));
  assert.equal(done.completedStages, 7);
});

test('source change after verify makes quality gates stale again', () => {
  const report = base({
    approved: { at: iso(20) }, traceability: { 'REQ-1': {}, 'REQ-2': {} },
    requirementStatus: base().requirementStatus.map((r) => ({ ...r, status: 'passed' })),
    verification: { passed: true, at: iso(60), checks: [{ name: 'format', passed: true }, { name: 'analyze', passed: true }, { name: 'tests', passed: true }] },
    sourceChangedSinceVerification: true
  });
  const p = derivePipeline(report, none);
  assert.equal(p.stages[5].status, 'active');
  assert.equal(p.stages[6].status, 'pending');
});

test('file timestamps never increase recorded completion or an estimated percentage', () => {
  const report = base({ approved: { at: iso(20) } });
  const before = derivePipeline(report, none);
  const after = derivePipeline(report, {
    lib: { total: 5, changed: 5, changedFiles: [] },
    test: { total: 5, changed: 5, changedFiles: [] }
  });
  assert.deepEqual(statuses(before), statuses(after));
  assert.equal(before.completedStages, after.completedStages);
  assert.equal(after.overallPct, undefined);
});

test('explicit implementation records advance only when every requirement is complete', () => {
  const report = base({ approved: { at: iso(20) }, taskStatus: [
    { id: 'REQ-1', phase: 'implementation', status: 'done' },
    { id: 'REQ-2', phase: 'implementation', status: 'in_progress' }
  ] });
  assert.equal(derivePipeline(report, none).stages[3].status, 'active');
  report.taskStatus[1].status = 'done';
  const complete = derivePipeline(report, none);
  assert.equal(complete.stages[3].status, 'completed');
  assert.equal(complete.stages[4].status, 'active');
  report.taskStatus[1].status = 'stale';
  assert.equal(derivePipeline(report, none).stages[3].status, 'active');
});

test('passing verification alone does not claim implementation and testing complete', () => {
  const report = base({ approved: { at: iso(20) }, verification: { passed: true } });
  const pipeline = derivePipeline(report, none);
  assert.equal(pipeline.stages[3].status, 'active');
  assert.equal(pipeline.stages[4].status, 'pending');
});

test('scanSignals counts only dart files touched since approval', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-sig-'));
  try {
    fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
    fs.mkdirSync(path.join(root, 'test'), { recursive: true });
    const old = path.join(root, 'lib/old.dart');
    fs.writeFileSync(old, '//');
    const past = new Date(Date.now() - 3600 * 1000);
    fs.utimesSync(old, past, past);
    fs.writeFileSync(path.join(root, 'lib/new.dart'), '//');
    fs.writeFileSync(path.join(root, 'test/new_test.dart'), '//');
    const sig = scanSignals(root, Date.now() - 60 * 1000);
    assert.equal(sig.lib.total, 2);
    assert.equal(sig.lib.changed, 1);
    assert.equal(sig.test.changed, 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('dashboard renders stage checklists, artifact dots and gate details', () => {
  const report = base({
    approved: { at: iso(20) },
    requirementStatus: [{ id: 'REQ-1', status: 'passed', description: 'd', acceptanceCriteria: ['a'],
      references: [{ kind: 'implementation', evidence: 'lib/a.dart' }, { kind: 'tests', evidence: 'test/a_test.dart' }] }],
    verification: { passed: false, at: iso(60), checks: [{ name: 'format', passed: true }, { name: 'analyze', passed: false, log: 'missing.txt' }] }
  });
  const html = generateDashboardHtml(report, os.tmpdir());
  assert.ok(html.includes('stage-steps'));
  assert.ok(html.includes('art-dot art-on'));
  assert.ok(html.includes('gate-meta'));
});
