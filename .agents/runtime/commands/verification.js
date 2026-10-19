'use strict';

const { GATES } = require('../constants');
const { hashFile, resolveProjectFile } = require('../fsutil');
const { gatePlan } = require('../gates');
const { preflight } = require('../preflight');
const { snapshot, specStatus, approvalStatus, buildReport } = require('../report');

/** Run the mechanical gates and persist a verification record bound to the current inputs. */
function verify(ctx) {
  const { root, store, execute } = ctx;
  const manifest = store.load();
  manifest.status = 'in_progress';
  manifest.verification = null;
  store.save(manifest); // Never retain an old PASS if a command crashes.

  const before = snapshot(root, manifest);
  const spec = specStatus(root, manifest);
  const issues = [...spec.issues, ...approvalStatus(root, manifest, spec).issues,
    ...preflight(root, manifest.backend)];
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
  if (!passed) throw new Error(`Verification blocked/failed. ${issues.join(' ')} Inspect issues and .fluttercrew/logs.`);
  return manifest;
}

/** Collect every reason the run cannot be marked done right now. */
function completionIssues(root, manifest) {
  return buildReport(root, manifest).report.completionIssues;
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
