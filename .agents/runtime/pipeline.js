'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['.git', '.dart_tool', 'build', 'node_modules', '.fluttercrew', '.idea']);
const GATES = [
  { name: 'format', label: 'dart format', sub: 'Code formatting style' },
  { name: 'analyze', label: 'flutter analyze', sub: 'Linter & type checking' },
  { name: 'tests', label: 'flutter test', sub: 'Unit & widget test suites' }
];
const CRITERIA = ['requirements', 'design', 'backend', 'security', 'experience'];

/**
 * Walk a source directory and report how many .dart files exist and how many
 * were created/modified at or after `sinceMs`. Cheap enough to run every 2s.
 */
function scanDir(dir, sinceMs, limit = 5000) {
  const out = { total: 0, changed: 0, latest: 0, changedFiles: [] };
  const walk = (current) => {
    if (out.total >= limit) return;
    let entries = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.dart')) continue;
      out.total++;
      let mtime = 0;
      try { mtime = fs.statSync(full).mtimeMs; } catch { continue; }
      out.latest = Math.max(out.latest, mtime);
      if (sinceMs > 0 && mtime >= sinceMs) {
        out.changed++;
        if (out.changedFiles.length < 8) out.changedFiles.push(path.relative(dir, full));
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

function scanSignals(root, sinceMs) {
  if (!root || !fs.existsSync(root)) return { lib: scanDir('', 0), test: scanDir('', 0) };
  return {
    lib: scanDir(path.join(root, 'lib'), sinceMs),
    test: {
      ...scanDir(path.join(root, 'test'), sinceMs),
      integration: scanDir(path.join(root, 'integration_test'), sinceMs)
    }
  };
}

const ts = (value) => (value ? new Date(value).getTime() : 0);
const step = (label, state, detail = '') => ({ label, state, detail });

/**
 * Derive the 7-stage pipeline from run state + filesystem signals.
 *
 * Stages are strictly sequential: a stage can only start once the previous one
 * started, so statuses can never "jump" (e.g. Testing DONE while Implementation
 * is still pending). Each stage exposes evidence-based checklist steps.
 */
function derivePipeline(report, signals = {}) {
  const lib = signals.lib || { total: 0, changed: 0, changedFiles: [] };
  const test = signals.test || { total: 0, changed: 0, changedFiles: [] };
  const integrationChanged = test.integration?.changed || 0;
  const testChanged = (test.changed || 0) + integrationChanged;

  const status = report?.status || 'not_started';
  const isStarted = !!report?.requirements;
  const hasSpec = !!report?.spec;
  const reqs = report?.requirementStatus || [];
  const totalReqs = reqs.length;
  const passedReqs = reqs.filter((r) => r.status === 'passed').length;
  const tracedAny = Object.keys(report?.traceability || {}).length > 0;
  const tracedCount = Object.keys(report?.traceability || {}).length;

  const specAt = ts(report?.spec?.at);
  const approvedAt = ts(report?.approved?.at);
  const approvedValid = hasSpec && !!report?.approved && (specAt === 0 || approvedAt >= specAt - 1000);
  const approvalStale = hasSpec && !!report?.approved && !approvedValid;

  const checks = report?.verification?.checks || [];
  const hasChecks = checks.length > 0;
  const verificationPassed = !!report?.verification?.passed;
  const verificationStale = verificationPassed && !!report?.sourceChangedSinceVerification;
  const verificationFresh = verificationPassed && !verificationStale;
  const acceptances = report?.acceptance || {};
  const missing = report?.missingOrStaleCriteria || [];
  const acceptedCount = CRITERIA.filter((c) => !!acceptances[c] && !missing.includes(c)).length;

  const allRequirementsPassed = totalReqs > 0 && passedReqs === totalReqs;
  const testStarted = approvedValid && (testChanged > 0 || tracedAny || hasChecks || verificationFresh);
  const testDone = approvedValid && (allRequirementsPassed || verificationFresh);

  const cond = [
    { start: true, done: isStarted },
    { start: isStarted, done: hasSpec },
    { start: hasSpec, done: approvedValid },
    { start: approvedValid, done: testStarted },
    { start: testStarted, done: testDone },
    { start: testDone || (approvedValid && hasChecks), done: verificationFresh },
    { start: verificationFresh, done: status === 'done' }
  ];

  const started = [];
  cond.forEach((c, i) => { started[i] = c.start && (i === 0 || started[i - 1]); });

  const statuses = cond.map((c, i) => {
    if (!started[i]) return 'pending';
    if (c.done) return 'completed';
    if (i === 5 && hasChecks && !verificationPassed) return 'failed';
    return 'active';
  });
  // First stage after a completed run of stages becomes active.
  const firstOpen = statuses.findIndex((s) => s === 'pending' || s === 'active' || s === 'failed');
  if (firstOpen >= 0 && statuses[firstOpen] === 'pending' && (firstOpen === 0 || statuses[firstOpen - 1] === 'completed')) {
    statuses[firstOpen] = 'active';
  }

  // ---- Stage details ------------------------------------------------------
  const pickState = (done, active) => (done ? 'done' : (active ? 'active' : 'todo'));
  const stageDefs = [
    {
      id: 'intake', number: 1, title: 'Intake & Brief', agent: 'planner',
      at: report?.startedAt,
      desc: isStarted ? `Brief: ${report.requirements}` : 'Waiting for requirements brief',
      steps: [
        step('Request captured as source brief', pickState(isStarted, !isStarted), report?.requirements || ''),
        step('Backend selected', pickState(isStarted, false), backendLabel(report?.backend))
      ]
    },
    {
      id: 'spec', number: 2, title: 'Architecture & Spec', agent: 'architect',
      at: report?.spec?.at,
      desc: hasSpec ? `Spec rev ${report.spec.revision || 1} - ${report.spec.ids?.length || 0} REQs` : (isStarted ? 'Defining MVVM schema & REQs' : 'Awaiting intake'),
      steps: [
        step('Requirement IDs baselined', pickState(hasSpec, isStarted && !hasSpec), hasSpec ? (report.spec.ids || []).join(', ') : ''),
        step('Acceptance criteria defined', pickState(hasSpec && totalReqs > 0, false),
          totalReqs ? `${reqs.reduce((n, r) => n + (r.acceptanceCriteria?.length || 0), 0)} criteria` : ''),
        step('Scope change report', pickState(!!report?.spec?.change, false), report?.spec?.change?.evidence || 'none (initial scope)')
      ]
    },
    {
      id: 'approval', number: 3, title: 'Dev Approval', agent: 'developer', human: true,
      at: approvedValid ? report.approved.at : null,
      desc: approvedValid ? 'Scope approved by Developer'
        : (approvalStale ? 'Spec revised - re-approval required' : (hasSpec ? 'Awaiting Developer review & approval' : 'Pending spec')),
      steps: [
        step('Developer reviewed REQs & criteria', pickState(approvedValid, hasSpec && !approvedValid), approvedValid ? (report.approved.notes || '') : ''),
        approvalStale ? step('Previous approval is stale (older than current spec)', 'fail', 'run: crew.js approve "<notes>"')
          : step('Coding unlocked', pickState(approvedValid, false))
      ]
    },
    {
      id: 'implementation', number: 4, title: 'MVVM Implementation', agent: 'flutter-reviewer',
      at: lib.changed > 0 ? lib.latest : null,
      desc: statuses[3] === 'completed' ? `MVVM slices written (${lib.changed} lib files touched)`
        : (approvedValid ? (lib.changed > 0 ? `Coding in progress - ${lib.changed} lib file(s) changed` : 'Ready to code MVVM slices') : 'Pending approval'),
      steps: [
        step('Models / services / viewmodels / views', pickState(testStarted, approvedValid && !testStarted),
          lib.changed > 0 ? `${lib.changed} of ${lib.total} lib files changed since approval` : 'no lib changes yet'),
        step('Source touched since approval', pickState(lib.changed > 0, approvedValid && lib.changed === 0), (lib.changedFiles || []).slice(0, 3).join(', '))
      ]
    },
    {
      id: 'testing', number: 5, title: 'Unit & Widget Testing', agent: 'tdd-guide',
      at: testChanged > 0 ? Math.max(test.latest || 0, test.integration?.latest || 0) : null,
      desc: statuses[4] === 'completed' ? `${passedReqs}/${totalReqs} requirements test-verified`
        : (testStarted ? `${testChanged} test file(s) changed - ${passedReqs}/${totalReqs} REQs traced passed` : 'Awaiting unit test suites'),
      steps: [
        step('Test files written', pickState(testChanged > 0 || tracedAny, testStarted && testChanged === 0),
          testChanged > 0 ? `${testChanged} changed (${(test.changedFiles || []).slice(0, 2).join(', ')})` : 'no test changes yet'),
        step('Requirements traced to code/tests/evidence', pickState(allRequirementsPassed, tracedAny && !allRequirementsPassed), `${tracedCount}/${totalReqs} traced`),
        step('All REQs passed', pickState(allRequirementsPassed, false), `${passedReqs}/${totalReqs}`)
      ]
    },
    {
      id: 'verify', number: 6, title: 'Quality Gates', agent: 'crew.js runtime',
      at: report?.verification?.at,
      desc: verificationFresh ? 'Format, analyze & tests PASSED'
        : (verificationStale ? 'Verification stale - source changed, re-run verify'
          : (hasChecks ? (verificationPassed ? 'Passed' : 'Gate failed - fix and re-run verify') : (started[5] ? 'Ready: run crew.js verify' : 'Queued'))),
      steps: GATES.map((g) => {
        const c = checks.find((x) => x.name === g.name);
        if (!c) return step(g.label, started[5] && !hasChecks ? 'active' : 'todo', 'not run');
        return step(g.label, c.passed ? (verificationStale ? 'fail' : 'done') : 'fail', verificationStale ? 'stale' : (c.passed ? 'passed' : `failed - see ${c.log || 'log'}`));
      })
    },
    {
      id: 'done', number: 7, title: 'Acceptance & Done', agent: 'fleet lead',
      at: latestAcceptance(acceptances),
      desc: status === 'done' ? 'Delivery complete' : `${acceptedCount}/5 criteria attested`,
      steps: CRITERIA.map((c) => {
        const attested = !!acceptances[c] && !missing.includes(c);
        const stale = !!acceptances[c] && missing.includes(c);
        return step(`${c} attestation`, attested ? 'done' : (stale ? 'fail' : (started[6] ? 'active' : 'todo')), stale ? 'stale' : (attested ? 'attested' : 'missing'));
      })
    }
  ];

  const stages = stageDefs.map((d, i) => ({ ...d, status: statuses[i] }));

  // ---- Weighted overall progress -----------------------------------------
  const weights = [5, 10, 10, 25, 20, 15, 15];
  const partial = [
    isStarted ? 1 : 0,
    hasSpec ? 1 : (isStarted ? 0.4 : 0),
    approvedValid ? 1 : (hasSpec ? 0.3 : 0),
    lib.changed > 0 ? 0.6 : 0.1,
    totalReqs ? (0.3 * (testChanged > 0 ? 1 : 0) + 0.7 * (passedReqs / totalReqs)) : 0,
    hasChecks ? checks.filter((c) => c.passed).length / 3 : 0.05,
    acceptedCount / 5
  ];
  let overallPct = 0;
  stages.forEach((s, i) => {
    if (s.status === 'completed') overallPct += weights[i];
    else if (s.status === 'active' || s.status === 'failed') overallPct += weights[i] * Math.min(partial[i], 0.95);
  });
  overallPct = status === 'done' ? 100 : Math.min(99, Math.round(overallPct));

  const current = stages.find((s) => s.status === 'active' || s.status === 'failed') || stages[stages.length - 1];
  return { stages, overallPct, current, approvedValid, approvalStale, testChanged, acceptedCount, verificationFresh, verificationStale };
}

function backendLabel(backend) {
  return backend ? `backend: ${backend}` : '';
}

function latestAcceptance(acceptances) {
  const times = Object.values(acceptances || {}).map((a) => ts(a?.at)).filter(Boolean);
  return times.length ? Math.max(...times) : null;
}

module.exports = { derivePipeline, scanSignals, GATES, CRITERIA };
