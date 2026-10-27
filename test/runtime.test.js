'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { run, preflight, criteria, commandCheck } = require('../.agents/runtime/crew');
const { validateSpec } = require('../.agents/runtime/spec');

function project(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluttercrew-'));
  const beforeCleanup = [];
  t.after(async () => {
    for (const cleanup of beforeCleanup.reverse()) await cleanup();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const write = (name, content) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  write('requirements.md', 'Implement a real feature.');
  write('pubspec.yaml', 'name: fixture\nenvironment:\n  sdk: ^3.0.0\n');
  write('lib/main.dart', 'void main() {}');
  write('test/feature_test.dart', '// Node fixture only; not an executed Flutter test.');
  const spec = { schemaVersion: 1, requirements: [{ id: 'REQ-001',
    description: 'Implement the requested feature.', source: 'requirements.md: first paragraph',
    acceptanceCriteria: ['The requested behavior works.'], verification: 'automated' }] };
  const calls = [];
  const execute = (_root, name, executable, args) => {
    calls.push({ name, executable, args });
    const log = `.fluttercrew/logs/${name}.txt`;
    write(log, `Node test double for ${executable}; no Flutter command was run.`);
    return { name, passed: true, log };
  };
  const invoke = (args, runner = execute) => {
    const original = console.log;
    console.log = () => {};
    try { return run(args, root, runner); } finally { console.log = original; }
  };
  const start = (backend = 'none', approved = true) => {
    const manifest = invoke(['start', 'requirements.md', backend]);
    write('spec.json', JSON.stringify(spec));
    invoke(['spec', 'spec.json']);
    if (approved) invoke(['approve', 'Node fixture developer decision']);
    return manifest;
  };
  const trace = (id = 'REQ-001', overrides = {}) => {
    write('.fluttercrew/evidence/feature.md', 'Node fixture result only, not real Flutter/backend evidence.');
    write(`.fluttercrew/traces/${id}.json`, JSON.stringify({ status: 'passed',
      implementation: ['lib/main.dart'], tests: ['test/feature_test.dart'],
      evidence: ['.fluttercrew/evidence/feature.md'], ...overrides }));
    return invoke(['trace', id, `.fluttercrew/traces/${id}.json`]);
  };
  const attest = () => {
    trace();
    criteria.forEach((id) => {
      write(`.fluttercrew/evidence/${id}.md`, `Test fixture attestation for ${id}; not real app evidence.`);
      invoke(['accept', id, `.fluttercrew/evidence/${id}.md`]);
    });
  };
  return { root, write, invoke, calls, start, attest, trace, spec,
    beforeCleanup: (cleanup) => beforeCleanup.push(cleanup) };
}

test('creates explicit run; prevents overwrite and invalid backend', (t) => {
  const p = project(t);
  assert.throws(() => p.start('automatic'), /Explicit backend/);
  assert.equal(p.start().status, 'in_progress');
  assert.throws(() => p.start(), /already exists/);
});

test('requirements must exist and be nonempty', (t) => {
  const p = project(t);
  assert.throws(() => p.invoke(['start', 'missing.md', 'none']));
  p.write('requirements.md', '');
  assert.throws(() => p.start(), /empty/);
});

test('status/verify without a run fail', (t) => {
  const p = project(t);
  assert.throws(() => p.invoke(['status']), /No run/);
  assert.throws(() => p.invoke(['verify']), /No run/);
});

test('finish rejects unverified work and missing evidence', (t) => {
  const p = project(t);
  p.start();
  assert.throws(() => p.invoke(['finish']), /passing verify/);
  p.invoke(['verify']);
  assert.throws(() => p.invoke(['finish']), /Missing\/stale/);
});

test('verification executes separate format/analyze/test gates', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  assert.deepEqual(p.calls.map((call) => call.name), ['format', 'analyze', 'tests']);
  assert.ok(p.calls[0].args.includes('--set-exit-if-changed'));
  assert.ok(p.calls[1].args.includes('--fatal-infos'));
  p.attest();
  assert.equal(p.invoke(['finish']).status, 'done');
});

test('a failed command blocks completion even with attestations', (t) => {
  const p = project(t);
  p.start();
  assert.throws(() => p.invoke(['verify'], (_root, name) => ({ name, passed: false })), /failed/);
  p.attest();
  assert.throws(() => p.invoke(['finish']), /passing verify/);
});

test('new failed verification cannot retain a previous passing result', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  assert.throws(() => p.invoke(['verify'], () => { throw new Error('crash'); }), /crash/);
  assert.equal(p.invoke(['status']).verification, null);
});

test('source changes invalidate verification and review evidence', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  p.write('lib/main.dart', 'void main() { print("changed"); }');
  assert.throws(() => p.invoke(['finish']), /passing verify/);
  p.invoke(['verify']);
  assert.throws(() => p.invoke(['finish']), /Missing\/stale/);
});

test('changing requirements invalidates completion', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  p.write('requirements.md', 'New mandatory feature');
  assert.throws(() => p.invoke(['finish']), /passing verify/);
});

test('changing evidence invalidates its recorded attestation', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  p.write('.fluttercrew/evidence/backend.md', 'Altered after review');
  assert.throws(() => p.invoke(['finish']), /backend evidence/);
});

test('modified command logs cannot support finish', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  p.invoke(['finish']);
  p.write('.fluttercrew/logs/tests.txt', 'Changed output');
  assert.equal(p.invoke(['status']).status, 'blocked');
  assert.throws(() => p.invoke(['finish']), /Changed tests execution log/);
});

test('status does not report done after source changes', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  p.invoke(['finish']);
  p.write('lib/main.dart', 'void main() { /* changed */ }');
  assert.equal(p.invoke(['status']).status, 'blocked');
});

test('partial acceptance cannot finish and missing evidence blocks', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.invoke(['accept', 'requirements', 'requirements.md']);
  p.invoke(['accept', 'design', 'requirements.md']);
  assert.throws(() => p.invoke(['finish']), /backend evidence/);
  p.attest();
  fs.unlinkSync(path.join(p.root, '.fluttercrew/evidence/security.md'));
  assert.throws(() => p.invoke(['finish']), /Invalid security evidence/);
});

test('generated caches are ignored but native source/config changes invalidate', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  p.write('android/.gradle/cache.bin', 'transient');
  p.write('ios/Pods/cache.bin', 'transient');
  assert.equal(p.invoke(['finish']).status, 'done');
  p.write('android/app/src/main/AndroidManifest.xml', '<manifest/>');
  assert.throws(() => p.invoke(['finish']), /passing verify/);
});

test('rejects traversal, empty evidence and run state as evidence', (t) => {
  const p = project(t);
  p.start();
  assert.throws(() => p.invoke(['accept', 'unknown', 'requirements.md']), /Criterion/);
  p.write('empty.md', '');
  assert.throws(() => p.invoke(['accept', 'backend', 'empty.md']), /Empty/);
  assert.throws(() => p.invoke(['accept', 'backend', '.fluttercrew/run.json']), /not evidence/);
  assert.throws(() => p.invoke(['accept', 'backend', path.join(p.root, 'requirements.md')]), /relative/);
  assert.throws(() => p.invoke(['accept', 'backend', '../outside.md']));
});

test('Firebase without generated configuration blocks before commands', (t) => {
  const p = project(t);
  p.start('firebase');
  assert.throws(() => p.invoke(['verify']), /blocked/);
  assert.equal(p.calls.length, 0);
  assert.ok(preflight(p.root, 'firebase').some((issue) => issue.includes('firebase_options')));
});

test('detects broad Firebase permissions and runtime fake classes', (t) => {
  const p = project(t);
  p.write('firestore.rules', 'allow read, write: if request.auth != null;');
  p.write('lib/fake.dart', 'class FakeProfileRepository {}');
  const issues = preflight(p.root, 'firebase');
  assert.ok(issues.some((issue) => issue.includes('Over-broad')));
  assert.ok(issues.some((issue) => issue.includes('fake backend')));
});

test('invalid Firebase JSON fails static preflight', (t) => {
  const p = project(t);
  p.write('firebase.json', 'not JSON');
  p.write('firestore.indexes.json', '[]');
  const issues = preflight(p.root, 'firebase');
  assert.equal(issues.filter((issue) => issue.includes('Invalid JSON')).length, 2);
});

test('broad multiline and split Firebase rules are flagged', (t) => {
  const p = project(t);
  for (const rules of ['allow read, write: if\n request.auth != null;',
    'allow read: if true; // TODO',
    'allow read: if request.auth != null; allow write: if request.auth != null;']) {
    p.write('firestore.rules', rules);
    assert.ok(preflight(p.root, 'firebase').some((issue) => issue.includes('Over-broad')));
  }
});

test('Supabase requires initialization and RLS migration', (t) => {
  const p = project(t);
  assert.equal(preflight(p.root, 'supabase').length, 2);
  p.write('lib/main.dart', 'void main() { Supabase.initialize(); }');
  p.write('supabase/migrations/001.sql', 'alter table profiles enable row level security; create policy owner on profiles;');
  assert.deepEqual(preflight(p.root, 'supabase'), []);
});

test('commands mutating source during verification require a new run', (t) => {
  const p = project(t);
  p.start();
  assert.throws(() => p.invoke(['verify'], (_root, name) => {
    p.write('lib/main.dart', name);
    return { name, passed: true };
  }), /failed/);
});

test('CLI installs adapters/runtime and backs up different existing files', (t) => {
  const p = project(t);
  p.write('AGENTS.md', 'User custom instructions');
  const cli = path.resolve(__dirname, '../bin/cli.js');
  const result = spawnSync(process.execPath, [cli, p.root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(p.root, '.agents/runtime/crew.js')));
  assert.ok(fs.existsSync(path.join(p.root, '.github/agents/fluttercrew.agent.md')));
  assert.equal(fs.existsSync(path.join(p.root, '.github/workflows/ci.yml')), false);
  const backup = fs.readdirSync(p.root).find((file) => /^AGENTS\.md\.fluttercrew-.*\.bak$/.test(file));
  assert.ok(backup);
  assert.equal(fs.readFileSync(path.join(p.root, backup), 'utf8'), 'User custom instructions');
  assert.ok(fs.readFileSync(path.join(p.root, '.gitignore'), 'utf8').includes('.fluttercrew/'));
  const start = spawnSync(process.execPath, [cli, 'start', 'requirements.md', 'none'], { cwd: p.root, encoding: 'utf8' });
  assert.equal(start.status, 0, start.stderr);
  const installed = spawnSync(process.execPath, ['.agents/runtime/crew.js', 'status'], { cwd: p.root, encoding: 'utf8' });
  assert.equal(installed.status, 0, installed.stderr);
  p.write('spec.json', JSON.stringify(p.spec));
  const baseline = spawnSync(process.execPath, ['.agents/runtime/crew.js', 'spec', 'spec.json'], {
    cwd: p.root, encoding: 'utf8',
  });
  assert.equal(baseline.status, 0, baseline.stderr);
});

test('real process runner records success and nonzero command logs', (t) => {
  const p = project(t);
  const pass = commandCheck(p.root, 'real-pass', process.execPath, ['-e', 'console.log("real output")']);
  assert.equal(pass.passed, true);
  assert.match(fs.readFileSync(path.join(p.root, pass.log), 'utf8'), /real output/);
  const fail = commandCheck(p.root, 'real-fail', process.execPath, ['-e', 'process.exit(2)']);
  assert.equal(fail.passed, false);
});

test('real process runner records missing executable as failed', (t) => {
  const p = project(t);
  const result = commandCheck(p.root, 'not-installed', 'fluttercrew-nonexistent-executable', []);
  assert.equal(result.passed, false);
  assert.match(fs.readFileSync(path.join(p.root, result.log), 'utf8'), /ENOENT/);
});

test('SDD: verification and completion require a spec, including legacy runs', (t) => {
  const p = project(t);
  p.invoke(['start', 'requirements.md', 'none']);
  const state = path.join(p.root, '.fluttercrew/run.json');
  const legacy = JSON.parse(fs.readFileSync(state, 'utf8'));
  legacy.schemaVersion = 1;
  delete legacy.spec;
  delete legacy.traceability;
  p.write('.fluttercrew/run.json', JSON.stringify(legacy));
  assert.ok(p.invoke(['status']).specIssues.length);
  assert.throws(() => p.invoke(['verify']), /blocked/);
  assert.equal(p.calls.length, 0);
  assert.throws(() => p.invoke(['finish']), /No spec baseline/);
  p.write('spec.json', JSON.stringify(p.spec));
  assert.equal(p.invoke(['spec', 'spec.json']).schemaVersion, 2);
});

test('SDD: malformed, empty, duplicate and untraceable specs are rejected', () => {
  for (const spec of [null, {}, { schemaVersion: 1, requirements: [] }]) {
    assert.throws(() => validateSpec(spec), /Spec requires/);
  }
  const requirement = { id: 'REQ-001', description: 'A behavior', source: 'Brief section 1',
    acceptanceCriteria: ['Observable result'], verification: 'automated' };
  assert.throws(() => validateSpec({ schemaVersion: 1, requirements: [requirement, requirement] }), /Duplicate/);
  for (const override of [{ id: 'invalid id' }, { description: '' }, { source: '' },
    { acceptanceCriteria: [] }, { acceptanceCriteria: [''] }, { verification: 'skipped' }]) {
    assert.throws(() => validateSpec({ schemaVersion: 1, requirements: [{ ...requirement, ...override }] }));
  }
});

test('SDD: green tests and all global reports cannot hide an omitted requirement', (t) => {
  const p = project(t);
  p.spec.requirements.push({ ...p.spec.requirements[0], id: 'REQ-002', description: 'A second mandatory behavior' });
  p.start();
  p.invoke(['verify']);
  p.attest();
  const status = p.invoke(['status']);
  assert.deepEqual(status.requirementStatus.map((item) => item.status), ['passed', 'pending']);
  assert.throws(() => p.invoke(['finish']), /REQ-002: pending/);
  p.trace('REQ-002');
  assert.equal(p.invoke(['finish']).status, 'done');
});

test('SDD: unknown IDs and skipped/blocked states cannot count as passed', (t) => {
  const p = project(t);
  p.start();
  assert.throws(() => p.trace('REQ-999'), /Unknown requirement/);
  assert.throws(() => p.trace('REQ-001', { status: 'skipped' }), /Trace status/);
  assert.throws(() => p.trace('REQ-001', { status: 'blocked', notes: '' }), /notes/);
  p.trace('REQ-001', { status: 'blocked', notes: 'Backend access missing' });
  assert.equal(p.invoke(['status']).requirementStatus[0].status, 'blocked');
  assert.throws(() => p.invoke(['finish']), /REQ-001: blocked/);
});

test('SDD: automated requirements need real file links in every category', (t) => {
  const p = project(t);
  p.start();
  for (const override of [{ implementation: [] }, { tests: [] }, { evidence: [] },
    { tests: ['test/missing.dart'] }, { evidence: ['requirements.md'] },
    { evidence: ['.fluttercrew/run.json'] }, { evidence: ['spec.json'] },
    { evidence: ['.fluttercrew/traces/REQ-001.json'] }]) {
    assert.throws(() => p.trace('REQ-001', override));
  }
  p.write('empty.txt', '');
  assert.throws(() => p.trace('REQ-001', { evidence: ['empty.txt'] }), /non-empty/);
});

test('SDD: visual-only manual verification requires a rationale', (t) => {
  const p = project(t);
  p.spec.requirements[0].verification = 'manual';
  p.start();
  assert.throws(() => p.trace('REQ-001', { tests: [] }), /testRationale/);
  p.trace('REQ-001', { tests: [], testRationale: 'Visual-only copy change; reviewed on target, see report.' });
  assert.equal(p.invoke(['status']).requirementStatus[0].status, 'passed');
});

test('SDD: modified trace report or linked execution evidence becomes stale', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  p.invoke(['finish']);
  p.write('.fluttercrew/evidence/feature.md', 'Changed after review');
  assert.equal(p.invoke(['status']).status, 'blocked');
  assert.throws(() => p.invoke(['finish']), /REQ-001: stale/);
  p.trace();
  p.write('.fluttercrew/traces/REQ-001.json', '{}');
  assert.equal(p.invoke(['status']).requirementStatus[0].status, 'stale');
});

test('SDD: deleting linked code or test files makes requirement evidence stale', (t) => {
  const p = project(t);
  p.start();
  p.trace();
  fs.unlinkSync(path.join(p.root, 'test/feature_test.dart'));
  assert.equal(p.invoke(['status']).requirementStatus[0].status, 'stale');
});

test('SDD: even linked source outside usual roots invalidates verification', (t) => {
  const p = project(t);
  p.start();
  p.write('custom/feature.dart', '// external-to-default-roots source');
  p.trace('REQ-001', { implementation: ['custom/feature.dart'] });
  p.invoke(['verify']);
  p.write('custom/feature.dart', '// changed');
  assert.equal(p.invoke(['status']).sourceChangedSinceVerification, true);
  assert.equal(p.invoke(['status']).requirementStatus[0].status, 'stale');
});

test('SDD: unchanged baseline preserves current gates', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  p.invoke(['finish']);
  const unchanged = p.invoke(['spec', 'spec.json']);
  assert.equal(unchanged.spec.revision, 1);
  assert.equal(unchanged.status, 'done');
  assert.equal(unchanged.verification.passed, true);
});

test('SDD: spec edits block completion and require explicit impact review', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  p.spec.requirements[0].description = 'Changed behavior';
  p.write('spec.json', JSON.stringify(p.spec));
  assert.throws(() => p.invoke(['finish']), /Spec changed/);
  assert.throws(() => p.trace(), /Spec changed/);
  assert.throws(() => p.invoke(['spec', 'spec.json']), /impact report/);
  p.write('change.md', 'Scope decision, affected IDs/code/tests and re-verification plan.');
  const revised = p.invoke(['spec', 'spec.json', 'change.md']);
  assert.equal(revised.spec.revision, 2);
  assert.equal(revised.specHistory.length, 1);
  assert.equal(revised.verification, null);
  assert.deepEqual(revised.traceability, {});
  assert.deepEqual(revised.acceptance, {});
  assert.throws(() => p.invoke(['finish']), /REQ-001: pending/);
});

test('SDD: changed brief and removed IDs cannot silently reuse prior approval', (t) => {
  const p = project(t);
  p.spec.requirements.push({ ...p.spec.requirements[0], id: 'REQ-002' });
  p.start();
  p.spec.requirements.pop();
  p.write('spec.json', JSON.stringify(p.spec));
  p.write('requirements.md', 'Explicit user-approved revised scope, recorded separately.');
  assert.throws(() => p.invoke(['spec', 'spec.json']), /impact report/);
  assert.throws(() => p.invoke(['verify']), /blocked/);
  p.write('change.md', 'REQ-002 removal decision, agreement reference and regression plan.');
  const revised = p.invoke(['spec', 'spec.json', 'change.md']);
  assert.deepEqual(revised.specHistory[0].ids, ['REQ-001', 'REQ-002']);
  assert.deepEqual(revised.spec.ids, ['REQ-001']);
  p.write('change.md', 'Modified after the review');
  assert.throws(() => p.trace(), /impact report/);
});

test('SDD: CLI exposes spec and trace through installed runtime', (t) => {
  const p = project(t);
  p.start();
  const cli = path.resolve(__dirname, '../bin/cli.js');
  const result = spawnSync(process.execPath, [cli, 'spec', 'spec.json'], { cwd: p.root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  p.write('pending.json', JSON.stringify({ status: 'pending', notes: 'Not implemented yet.' }));
  const trace = spawnSync(process.execPath, [cli, 'trace', 'REQ-001', 'pending.json'], { cwd: p.root, encoding: 'utf8' });
  assert.equal(trace.status, 0, trace.stderr);
});

test('SDD: linking another requirement\'s external source keeps unrelated traces fresh', (t) => {
  const p = project(t);
  p.spec.requirements.push({ ...p.spec.requirements[0], id: 'REQ-002' });
  p.start();
  p.write('custom/one.dart', '// source one');
  p.write('custom/two.dart', '// source two');
  p.trace('REQ-001', { implementation: ['custom/one.dart'] });
  p.trace('REQ-002', { implementation: ['custom/two.dart'] });
  assert.deepEqual(p.invoke(['status']).requirementStatus.map((entry) => entry.status), ['passed', 'passed']);
  // Editing only REQ-001's linked file invalidates REQ-001, not REQ-002.
  p.write('custom/one.dart', '// source one changed');
  assert.deepEqual(p.invoke(['status']).requirementStatus.map((entry) => entry.status), ['stale', 'passed']);
  p.trace('REQ-001', { implementation: ['custom/one.dart'] });
  assert.deepEqual(p.invoke(['status']).requirementStatus.map((entry) => entry.status), ['passed', 'passed']);
});

test('SDD: scope revision report must be separate from brief, spec and state', (t) => {
  const p = project(t);
  p.start();
  p.spec.requirements[0].description = 'Revised';
  p.write('spec.json', JSON.stringify(p.spec));
  for (const report of ['requirements.md', 'spec.json', '.fluttercrew/run.json']) {
    assert.throws(() => p.invoke(['spec', 'spec.json', report]), /separate non-empty/);
  }
});

test('agent-captured inline request needs no special filename and retains delivery gates', (t) => {
  const p = project(t);
  const source = 'docs/fluttercrew/request-002.md';
  const request = 'Tạo app ghi chú cục bộ, không dùng backend. Dùng Riverpod.';
  // The file tool/agent performs this capture. This test does not invoke an LLM.
  p.write(source, `# Captured request\n\n## User request\n${request}\n\n## Agent assumptions\nNone.\n`);
  const manifest = p.invoke(['start', source, 'none']);
  assert.equal(manifest.requirements, source);
  assert.throws(() => p.invoke(['finish']), /No spec baseline/);
  p.spec.requirements[0].source = `${source}: User request`;
  p.write('spec.json', JSON.stringify(p.spec));
  p.invoke(['spec', 'spec.json']);
  p.invoke(['approve']);
  p.invoke(['verify']);
  assert.throws(() => p.invoke(['finish']), /REQ-001: pending/);
  p.attest();
  assert.equal(p.invoke(['finish']).status, 'done');
  assert.ok(fs.readFileSync(path.join(p.root, source), 'utf8').includes(request));
});

test('agent-captured Firebase prompt still blocks on real backend prerequisites', (t) => {
  const p = project(t);
  const source = 'captured-idea.md';
  p.write(source, '# User request\nTạo app A dùng Firebase Auth và Firestore.');
  p.invoke(['start', source, 'firebase']);
  p.spec.requirements[0].source = `${source}: User request`;
  p.write('spec.json', JSON.stringify(p.spec));
  p.invoke(['spec', 'spec.json']);
  assert.throws(() => p.invoke(['verify']), /blocked/);
  const status = p.invoke(['status']);
  assert.equal(status.backend, 'firebase');
  assert.ok(status.preflight.some((issue) => issue.includes('firebase_options.dart')));
  assert.equal(p.calls.length, 0);
});

test('status and dashboard command generate live html dashboard', (t) => {
  const p = project(t);
  p.invoke(['start', 'requirements.md', 'none']);
  const status = p.invoke(['status']);
  const dashboardPath = path.join(p.root, '.fluttercrew', 'dashboard.html');
  assert.ok(fs.existsSync(dashboardPath));
  const html = fs.readFileSync(dashboardPath, 'utf8');
  assert.ok(html.includes('FlutterCrew Live Workflow'));
  assert.ok(html.includes('Pipeline Lifecycle'));
  assert.ok(html.includes('id="intake-processing-card"'));
  assert.ok(html.includes('Active Intake &amp; Spec Breakdown in Progress...'));
  assert.ok(html.includes('Phase 1 → 2 Active'));
  
  p.write('spec.json', JSON.stringify(p.spec));
  p.invoke(['spec', 'spec.json']);
  p.invoke(['status']);
  const specHtml = fs.readFileSync(dashboardPath, 'utf8');
  assert.ok(!specHtml.includes('id="intake-processing-card"'));
  assert.ok(specHtml.includes('REQ-001'));
  assert.ok(specHtml.includes('req-card'));
  assert.ok(specHtml.includes('Unfold All'));
  assert.ok(specHtml.includes('Acceptance Criteria'));

  const dashResult = p.invoke(['dashboard']);
  assert.ok(fs.existsSync(dashResult.htmlPath));
  assert.ok(dashResult.fileUrl.startsWith('file://'));
});

test('archive command preserves history and clears state for next run', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  assert.equal(p.invoke(['finish']).status, 'done');
  assert.equal(p.invoke(['status']).status, 'done');

  // Archive with custom tag
  const archiveResult = p.invoke(['archive', 'auth-feature']);
  assert.ok(archiveResult.archiveDir);
  assert.ok(fs.existsSync(path.join(archiveResult.archiveDir, 'run.json')));
  assert.equal(fs.existsSync(path.join(p.root, '.fluttercrew/run.json')), false);

  // Ready to start fresh run without conflict
  p.write('new-req.md', 'Brand new feature');
  const newRun = p.invoke(['start', 'new-req.md', 'none']);
  assert.equal(newRun.status, 'in_progress');
  assert.equal(newRun.requirements, 'new-req.md');
});

test('start --archive automatically archives completed run', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  assert.equal(p.invoke(['finish']).status, 'done');
  assert.equal(p.invoke(['status']).status, 'done');

  // Starting new run with --archive
  p.write('next-req.md', 'Next feature prompt');
  const nextRun = p.invoke(['start', 'next-req.md', 'none', '--archive']);
  assert.equal(nextRun.status, 'in_progress');
  assert.equal(nextRun.requirements, 'next-req.md');

  // Verify history folder was created
  const historyDir = path.join(p.root, 'docs/fluttercrew/history');
  assert.ok(fs.existsSync(historyDir));
  const entries = fs.readdirSync(historyDir);
  assert.ok(entries.length >= 1);
});

test('CLI uninstalls fleet and restores backed up files', (t) => {
  const p = project(t);
  p.write('AGENTS.md', 'User custom instructions');
  const cli = path.resolve(__dirname, '../bin/cli.js');
  const installResult = spawnSync(process.execPath, [cli, p.root], { encoding: 'utf8' });
  assert.equal(installResult.status, 0, installResult.stderr);
  assert.ok(fs.existsSync(path.join(p.root, '.agents')));
  
  const uninstallResult = spawnSync(process.execPath, [cli, 'uninstall', p.root], { encoding: 'utf8' });
  assert.equal(uninstallResult.status, 0, uninstallResult.stderr);
  assert.equal(fs.existsSync(path.join(p.root, '.agents')), false);
  assert.equal(fs.existsSync(path.join(p.root, '.fluttercrew')), false);
  assert.equal(fs.existsSync(path.join(p.root, '.github/prompts')), false);
  assert.equal(fs.readFileSync(path.join(p.root, 'AGENTS.md'), 'utf8'), 'User custom instructions');
});

test('approval is required by verify and finish, not just the workflow', (t) => {
  const p = project(t);
  p.start('none', false);
  p.attest();
  assert.throws(() => p.invoke(['verify']), /approval is missing/);
  assert.equal(p.calls.length, 0);
  assert.throws(() => p.invoke(['finish']), /approval is missing/);
  const approved = p.invoke(['approve', 'Reviewed REQ-001']);
  assert.equal(approved.approved.specRevision, approved.spec.revision);
  assert.equal(approved.approved.specHash, approved.spec.hash);
  assert.equal(approved.approved.requirementsHash, approved.spec.requirementsHash);
  p.invoke(['verify']);
  assert.equal(p.invoke(['finish']).status, 'done');
});

test('legacy timestamp-only approval is stale even with all passing evidence', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  const manifest = p.invoke(['finish']);
  manifest.approved = { at: new Date().toISOString(), notes: 'Legacy approval' };
  p.write('.fluttercrew/run.json', JSON.stringify(manifest));
  assert.equal(p.invoke(['status']).approvalStatus.status, 'stale');
  assert.equal(p.invoke(['dashboard']).report.status, 'blocked');
  assert.throws(() => p.invoke(['finish']), /approval is stale or unbound/);
  const calls = p.calls.length;
  assert.throws(() => p.invoke(['verify']), /approval is stale or unbound/);
  assert.equal(p.calls.length, calls);
});

test('approve rejects dirty spec, brief and impact reports; revisions require reapproval', (t) => {
  const p = project(t);
  p.start();
  const original = p.invoke(['status']).approved;
  p.spec.requirements[0].description = 'Updated scope';
  p.write('spec.json', JSON.stringify(p.spec));
  assert.throws(() => p.invoke(['approve']), /Spec changed/);
  p.write('change.md', 'Reviewed scope and regression impact');
  p.invoke(['spec', 'spec.json', 'change.md']);
  assert.deepEqual(p.invoke(['status']).approved, original);
  assert.equal(p.invoke(['status']).approvalStatus.status, 'stale');
  assert.throws(() => p.invoke(['verify']), /approval is stale/);
  p.invoke(['approve']);
  p.invoke(['verify']);
  p.write('requirements.md', 'Changed brief');
  assert.throws(() => p.invoke(['approve']), /Original requirements changed/);
  p.write('requirements.md', 'Implement a real feature.');
  p.write('change.md', 'Changed impact evidence');
  assert.throws(() => p.invoke(['approve']), /impact report/);
});

test('unchanged spec preserves approval and resume leaves all valid evidence untouched', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  p.invoke(['finish']);
  const before = fs.readFileSync(path.join(p.root, '.fluttercrew/run.json'), 'utf8');
  p.invoke(['spec', 'spec.json']);
  const report = p.invoke(['resume']);
  assert.equal(report.status, 'done');
  assert.deepEqual(report.resume.retained, {
    spec: true, approval: true, verification: true, requirements: ['REQ-001'], criteria, tasks: []
  });
  assert.deepEqual(report.resume.remaining, []);
  assert.equal(fs.readFileSync(path.join(p.root, '.fluttercrew/run.json'), 'utf8'), before);
  assert.equal(p.calls.length, 3);
});

for (const [name, file, content] of [
  ['source', 'lib/main.dart', 'void main() { /* update */ }'],
  ['spec', 'spec.json', '{}'],
  ['brief', 'requirements.md', 'Changed brief'],
  ['review', '.fluttercrew/evidence/backend.md', 'Changed review'],
  ['trace', '.fluttercrew/traces/REQ-001.json', '{}'],
  ['linked evidence', '.fluttercrew/evidence/feature.md', 'Changed evidence'],
  ['execution log', '.fluttercrew/logs/tests.txt', 'Changed log']
]) {
  test(`status, dashboard and watcher renderer agree after ${name} changes`, (t) => {
    const p = project(t);
    p.start();
    p.invoke(['verify']);
    p.attest();
    p.invoke(['finish']);
    p.write(file, content);
    const status = p.invoke(['status']);
    const dashboard = p.invoke(['dashboard']).report;
    const { refreshDashboard } = require('../.agents/runtime/report');
    const { createStore } = require('../.agents/runtime/state');
    const watcherReport = refreshDashboard(p.root, createStore(p.root)).report;
    assert.equal(status.status, 'blocked');
    assert.deepEqual(dashboard, status);
    assert.deepEqual(watcherReport, status);
    const html = fs.readFileSync(path.join(p.root, '.fluttercrew/dashboard.html'), 'utf8');
    assert.match(html, /status: blocked/);
    assert.match(html, /Needs attention/);
    assert.throws(() => p.invoke(['finish']));
  });
}

test('resume requests only the invalidated review, retaining verification and other evidence', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  p.invoke(['finish']);
  p.write('.fluttercrew/evidence/backend.md', 'Changed backend report');
  const report = p.invoke(['resume']);
  assert.equal(report.resume.retained.verification, true);
  assert.deepEqual(report.resume.retained.requirements, ['REQ-001']);
  assert.deepEqual(report.resume.retained.criteria, criteria.filter((id) => id !== 'backend'));
  assert.deepEqual(report.nextActions.map((entry) => entry.kind), ['review']);
  assert.deepEqual(report.nextAction.commands, [
    'node .agents/runtime/crew.js accept backend ".fluttercrew/evidence/backend.md"'
  ]);
  assert.equal(p.calls.length, 3);
});

test('resume identifies source changes and exact commands for stale work', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  p.write('lib/main.dart', 'void main() { /* changed */ }');
  const report = p.invoke(['resume']);
  assert.equal(report.nextAction.issue, 'Source changed');
  assert.deepEqual(report.nextAction.commands, ['node .agents/runtime/crew.js verify']);
  assert.equal(report.resume.retained.approval, true);
  assert.equal(report.resume.retained.verification, false);
  assert.deepEqual(report.resume.retained.requirements, []);
  assert.deepEqual(report.resume.retained.criteria, []);
  assert.equal(report.nextActions.filter((entry) => entry.kind === 'review').length, 5);
  assert.equal(report.nextActions.filter((entry) => entry.kind === 'trace').length, 1);
});

test('invalid or incomplete verification records cannot finish or appear current', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  const manifest = p.invoke(['finish']);
  manifest.verification.checks = [manifest.verification.checks[0], manifest.verification.checks[0], manifest.verification.checks[0]];
  p.write('.fluttercrew/run.json', JSON.stringify(manifest));
  assert.equal(p.invoke(['status']).verificationStatus.valid, false);
  assert.equal(p.invoke(['dashboard']).report.status, 'blocked');
  assert.throws(() => p.invoke(['finish']), /all format\/analyze\/tests gates/);
});

test('gate badges use live log integrity, including a partially failed verification', (t) => {
  const p = project(t);
  p.start();
  assert.throws(() => p.invoke(['verify'], (_root, name) => {
    const log = `.fluttercrew/logs/${name}.txt`;
    p.write(log, `Actual test-double output for ${name}`);
    return { name, log, passed: name !== 'tests' };
  }), /failed/);
  let report = p.invoke(['status']);
  assert.deepEqual(report.verificationStatus.checks.map((check) => check.status), ['passed', 'passed', 'failed']);
  p.write('.fluttercrew/logs/format.txt', 'Changed output');
  report = p.invoke(['dashboard']).report;
  assert.deepEqual(report.verificationStatus.checks.map((check) => check.status), ['stale', 'passed', 'failed']);
  const html = fs.readFileSync(path.join(p.root, '.fluttercrew/dashboard.html'), 'utf8');
  assert.match(html, /1\/3 Passed/);
  assert.match(html, /gate-stale">STALE/);
  assert.match(html, /gate-fail">FAILED/);
});

test('explicit tasks validate inputs, persist notes and block finish until resolved', (t) => {
  const p = project(t);
  p.start();
  for (const args of [
    ['REQ-999', 'implementation', 'done', 'note'],
    ['REQ-001', 'unknown', 'done', 'note'],
    ['REQ-001', 'testing', 'skipped', 'note'],
    ['REQ-001', 'testing', 'done', '']
  ]) assert.throws(() => p.invoke(['task', ...args]));
  p.invoke(['task', 'REQ-001', 'implementation', 'in_progress', 'Implementing state transitions']);
  const report = p.invoke(['resume']);
  assert.equal(report.taskStatus[0].notes, 'Implementing state transitions');
  assert.equal(report.taskStatus[0].status, 'in_progress');
  assert.ok(report.nextActions.some((action) => action.kind === 'task'));
  p.invoke(['verify']);
  p.attest();
  assert.throws(() => p.invoke(['finish']), /REQ-001 implementation: in_progress/);
  p.invoke(['task', 'REQ-001', 'implementation', 'done', 'State transitions implemented']);
  p.invoke(['task', 'REQ-001', 'testing', 'blocked', 'Missing target access']);
  assert.equal(p.invoke(['status']).status, 'blocked');
  assert.throws(() => p.invoke(['finish']), /REQ-001 testing: blocked/);
  p.invoke(['task', 'REQ-001', 'testing', 'done', 'Tests executed; see requirement evidence']);
  assert.equal(p.invoke(['finish']).status, 'done');
});

test('completed tasks become stale after source or spec changes', (t) => {
  const p = project(t);
  p.start();
  p.invoke(['task', 'REQ-001', 'implementation', 'done', 'Feature written']);
  p.write('lib/main.dart', 'void main() { /* updated */ }');
  assert.equal(p.invoke(['resume']).taskStatus[0].status, 'stale');
  assert.equal(p.invoke(['resume']).taskStatus[0].recordedStatus, 'done');
  p.invoke(['task', 'REQ-001', 'implementation', 'done', 'Feature updated']);
  assert.equal(p.invoke(['resume']).taskStatus[0].status, 'done');
  p.spec.requirements[0].description = 'New scope';
  p.write('spec.json', JSON.stringify(p.spec));
  p.write('change.md', 'Reviewed impact');
  p.invoke(['spec', 'spec.json', 'change.md']);
  assert.equal(p.invoke(['resume']).taskStatus[0].status, 'stale');
});

test('dashboard fails explicitly for corrupt run state, rather than pretending no run', (t) => {
  const p = project(t);
  p.start();
  p.write('.fluttercrew/run.json', '{invalid');
  assert.throws(() => p.invoke(['dashboard']), SyntaxError);
  assert.throws(() => p.invoke(['resume']), SyntaxError);
});

test('CLI routes task and resume without reinstalling or starting a run', (t) => {
  const p = project(t);
  p.start();
  const cli = path.resolve(__dirname, '../bin/cli.js');
  const task = spawnSync(process.execPath, [cli, 'task', 'REQ-001', 'implementation', 'in_progress', 'Working on model'], {
    cwd: p.root, encoding: 'utf8'
  });
  assert.equal(task.status, 0, task.stderr);
  const resume = spawnSync(process.execPath, [cli, 'resume'], { cwd: p.root, encoding: 'utf8' });
  assert.equal(resume.status, 0, resume.stderr);
  assert.equal(JSON.parse(resume.stdout).taskStatus[0].status, 'in_progress');
});

test('live watcher stays alive after done and renders subsequent invalidation', async (t) => {
  const p = project(t);
  p.start();
  p.invoke(['verify']);
  p.attest();
  p.invoke(['finish']);
  const modulePath = (name) => JSON.stringify(path.resolve(__dirname, `../.agents/runtime/${name}`));
  const observations = path.join(p.root, '.fluttercrew/observations.txt');
  const child = spawn(process.execPath, ['-e', `
    const fs = require('node:fs');
    const { watch } = require(${modulePath('watcher')});
    const { refreshDashboard } = require(${modulePath('report')});
    const { createStore } = require(${modulePath('state')});
    const root = ${JSON.stringify(p.root)};
    watch(root, () => {
      const report = refreshDashboard(root, createStore(root)).report;
      fs.appendFileSync(${JSON.stringify(observations)}, report.status + '\\n');
      return report;
    }, { intervalMs: 20 });
  `], { stdio: ['ignore', 'ignore', 'pipe'] });
  let errors = '';
  child.stderr.on('data', (chunk) => { errors += chunk; });
  const exited = new Promise((resolve) => child.once('exit', resolve));
  p.beforeCleanup(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    await exited;
  });
  const waitFor = async (predicate) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (fs.existsSync(observations) && predicate(fs.readFileSync(observations, 'utf8'))) return;
      assert.equal(child.exitCode, null, errors);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.fail(`Watcher did not produce expected state: ${errors}`);
  };
  await waitFor((text) => text.trim().split('\n').length >= 4);
  p.write('lib/main.dart', 'void main() { /* post-DONE edit */ }');
  await waitFor((text) => text.includes('blocked'));
  assert.match(fs.readFileSync(path.join(p.root, '.fluttercrew/dashboard.html'), 'utf8'), /status: blocked/);
});