'use strict';

const { CRITERIA, GATES } = require('../constants');
const { hashFile, resolveProjectFile } = require('../fsutil');
const { gatePlan } = require('../gates');
const { preflight } = require('../preflight');
const { snapshot, specStatus, traceStatus } = require('../report');

/** Run the mechanical gates and persist a verification record bound to the current inputs. */
function verify(ctx) {
  const { root, store, execute } = ctx;
  const manifest = store.load();
  manifest.status = 'in_progress';
  manifest.verification = null;
  store.save(manifest); // Never retain an old PASS if a command crashes.

  const before = snapshot(root, manifest);
  const issues = [...preflight(root, manifest.backend), ...specStatus(root, manifest).issues];
  const checks = issues.length
    ? []
    : gatePlan(root).map(({ name, executable, args }) => execute(root, name, executable, args));

  for (const check of checks) {
    try { check.hash = hashFile(resolveProjectFile(root, check.log)); }
    catch { issues.push(`Missing ${check.name} execution log.`); }
  }
  const after = snapshot(root, manifest);
  if (before !== after) issues.push('Inputs changed during verification. Run verify again.');

  const passed = issues.length === 0 && checks.length === GATES.length && checks.every((check) => check.passed);
  manifest.verification = { passed, snapshot: after, issues, checks, at: new Date().toISOString() };
  manifest.status = passed ? 'in_progress' : 'blocked';
  store.save(manifest);
  console.log(JSON.stringify(manifest.verification, null, 2));
  if (!passed) throw new Error('Verification blocked/failed. Inspect issues and .fluttercrew/logs.');
  return manifest;
}

/** Collect every reason the run cannot be marked done right now. */
function completionIssues(root, manifest) {
  const current = snapshot(root, manifest);
  const issues = [...preflight(root, manifest.backend), ...traceStatus(root, manifest, current).issues];

  if (!manifest.verification?.passed || manifest.verification.snapshot !== current) {
    issues.push('A passing verify for current inputs is required.');
  }
  for (const check of manifest.verification?.checks || []) {
    try {
      if (!check.hash) issues.push(`Missing ${check.name} execution-log hash. Run verify again.`);
      else if (hashFile(resolveProjectFile(root, check.log)) !== check.hash) issues.push(`Changed ${check.name} execution log.`);
    } catch { issues.push(`Missing ${check.name} execution log.`); }
  }
  for (const id of CRITERIA) {
    const entry = manifest.acceptance[id];
    try {
      if (!entry || entry.snapshot !== current || hashFile(resolveProjectFile(root, entry.evidence)) !== entry.hash) {
        issues.push(`Missing/stale ${id} evidence.`);
      }
    } catch { issues.push(`Invalid ${id} evidence.`); }
  }
  return issues;
}

function finish(ctx) {
  const { root, store } = ctx;
  const manifest = store.load();
  const issues = completionIssues(root, manifest);
  manifest.status = issues.length ? 'blocked' : 'done';
  store.save(manifest);
  if (issues.length) throw new Error(issues.join('\n'));
  console.log('DONE: all spec requirements traced, local gates passed and review attestations recorded. Not a production certification.');
  return manifest;
}

module.exports = { verify, finish, completionIssues };
