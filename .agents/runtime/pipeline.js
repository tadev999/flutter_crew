'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { GATES, CRITERIA } = require('./constants');

const SKIP_DIRS = new Set(['.git', '.dart_tool', 'build', 'node_modules', '.fluttercrew', '.idea']);

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
 * Project the canonical live report into stages. Filesystem timestamps are
 * activity hints only; they never complete a stage or contribute progress.
 */
function derivePipeline(report, signals = {}) {
  const lib = signals.lib || { total: 0, changed: 0, changedFiles: [] };
  const test = signals.test || { total: 0, changed: 0, changedFiles: [] };
  const integrationChanged = test.integration?.changed || 0;
  const testChanged = (test.changed || 0) + integrationChanged;

  const status = report?.status || 'not_started';
  const isStarted = !!report?.requirements;
  const hasSpec = !!report?.spec && !(report?.specIssues || []).length;
  const reqs = report?.requirementStatus || [];
  const totalReqs = reqs.length;
  const passedReqs = reqs.filter((r) => r.status === 'passed').length;
  const tracedAny = Object.keys(report?.traceability || {}).length > 0;
  const tracedCount = Object.keys(report?.traceability || {}).length;

  const approvedValid = hasSpec && report?.approvalStatus?.valid === true;
  const approvalStale = report?.approvalStatus?.status === 'stale';

  const checks = report?.verification?.checks || [];
  const hasChecks = checks.length > 0;
  const verificationPassed = !!report?.verification?.passed;
  const verificationFresh = report?.verificationStatus?.valid === true;
  const verificationStale = verificationPassed && !verificationFresh;
  const acceptances = report?.acceptance || {};
  const missing = report?.missingOrStaleCriteria || [];
  const criteria = report?.criteria || CRITERIA;
  const gateDefs = report?.gates || GATES;
  const acceptedCount = criteria.filter((c) => !!acceptances[c] && !missing.includes(c)).length;

  const allRequirementsPassed = totalReqs > 0 && passedReqs === totalReqs;
  const tasks = report?.taskStatus || [];
  const phaseComplete = (phase) => totalReqs > 0 && reqs.every((req) => {
    const task = tasks.find((entry) => entry.id === req.id && entry.phase === phase);
    return task ? task.status === 'done' : req.status === 'passed';
  });
  const implementationDone = approvedValid && phaseComplete('implementation');
  const testStarted = implementationDone;
  const testDone = testStarted && allRequirementsPassed && phaseComplete('testing');

  const cond = [
    { start: true, done: isStarted },
    { start: isStarted, done: hasSpec },
    { start: hasSpec, done: approvedValid },
    { start: approvedValid, done: implementationDone },
    { start: testStarted, done: testDone },
    { start: testDone, done: verificationFresh },
    { start: testDone && verificationFresh, done: status === 'done' }
  ];

  const started = [];
  cond.forEach((c, i) => { started[i] = c.start && (i === 0 || (started[i - 1] && cond[i - 1].done)); });

  const statuses = cond.map((c, i) => {
    if (!started[i]) return 'pending';
    if (c.done) return 'completed';
    if (i === 5 && report?.verificationStatus?.status === 'failed') return 'failed';
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
      desc: hasSpec ? `Spec rev ${report.spec.revision || 1} - ${report.spec.ids?.length || 0} REQs` : (isStarted ? 'Defining architecture & REQs' : 'Awaiting intake'),
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
        approvalStale ? step('Approval does not match the current spec baseline', 'fail', 'run: crew.js approve "<notes>"')
          : step('Runtime approval gate satisfied', pickState(approvedValid, false))
      ]
    },
    {
      id: 'implementation', number: 4, title: 'Implementation', agent: 'flutter-reviewer',
      at: lib.changed > 0 ? lib.latest : null,
      desc: statuses[3] === 'completed' ? 'Implementation recorded for all requirements'
        : (approvedValid ? 'Record implementation tasks or complete requirement traces' : 'Pending approval'),
      steps: [
        step('Implementation tasks / passed traces', pickState(implementationDone, approvedValid && !implementationDone),
          'Explicit records, not file modification times'),
        step('Source activity (hint only)', lib.changed > 0 ? 'active' : 'todo',
          `${lib.changed} lib files touched; ${(lib.changedFiles || []).slice(0, 3).join(', ')}`)
      ]
    },
    {
      id: 'testing', number: 5, title: 'Unit & Widget Testing', agent: 'tdd-guide',
      at: testChanged > 0 ? Math.max(test.latest || 0, test.integration?.latest || 0) : null,
      desc: statuses[4] === 'completed' ? `${passedReqs}/${totalReqs} requirements test-verified`
        : (testStarted ? `${testChanged} test file(s) changed - ${passedReqs}/${totalReqs} REQs traced passed` : 'Awaiting unit test suites'),
      steps: [
        step('Test activity (hint only)', testChanged > 0 ? 'active' : 'todo',
          testChanged > 0 ? `${testChanged} changed (${(test.changedFiles || []).slice(0, 2).join(', ')})` : 'no test changes yet'),
        step('Requirements traced to code/tests/evidence', pickState(allRequirementsPassed, tracedAny && !allRequirementsPassed), `${tracedCount}/${totalReqs} traced`),
        step('All REQs passed', pickState(allRequirementsPassed, false), `${passedReqs}/${totalReqs}`)
      ]
    },
    {
      id: 'verify', number: 6, title: 'Quality Gates', agent: 'crew.js runtime',
      at: report?.verification?.at,
      desc: verificationFresh ? 'Format, analyze & tests PASSED'
        : (verificationStale ? 'Verification stale - inputs or execution logs changed, re-run verify'
          : (hasChecks ? (verificationPassed ? 'Passed' : 'Gate failed - fix and re-run verify') : (started[5] ? 'Ready: run crew.js verify' : 'Queued'))),
      steps: gateDefs.map((g) => {
        const c = checks.find((x) => x.name === g.name);
        const state = report?.verificationStatus?.checks?.find((check) => check.name === g.name)?.status || 'pending';
        if (state === 'pending') return step(g.label, started[5] && !hasChecks ? 'active' : 'todo', 'not run');
        return step(g.label, state === 'passed' ? 'done' : 'fail',
          state === 'failed' ? `failed - see ${c?.log || 'log'}` : state);
      })
    },
    {
      id: 'done', number: 7, title: 'Acceptance & Done', agent: 'fleet lead',
      at: latestAcceptance(acceptances),
      desc: status === 'done' ? 'Delivery complete' : `${acceptedCount}/${criteria.length} criteria attested`,
      steps: criteria.map((c) => {
        const attested = !!acceptances[c] && !missing.includes(c);
        const stale = !!acceptances[c] && missing.includes(c);
        return step(`${c} attestation`, attested ? 'done' : (stale ? 'fail' : (started[6] ? 'active' : 'todo')), stale ? 'stale' : (attested ? 'attested' : 'missing'));
      })
    }
  ];

  const stages = stageDefs.map((d, i) => ({ ...d, status: statuses[i] }));

  const completedStages = stages.filter((stage) => stage.status === 'completed').length;
  const current = stages.find((s) => s.status === 'active' || s.status === 'failed') || stages[stages.length - 1];
  return { stages, completedStages, current, approvedValid, approvalStale, testChanged, acceptedCount, verificationFresh, verificationStale };
}

function backendLabel(backend) {
  return backend ? `backend: ${backend}` : '';
}

function latestAcceptance(acceptances) {
  const times = Object.values(acceptances || {}).map((a) => ts(a?.at)).filter(Boolean);
  return times.length ? Math.max(...times) : null;
}

module.exports = { derivePipeline, scanSignals, GATES, CRITERIA };
