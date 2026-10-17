'use strict';

const path = require('node:path');
const { CRITERIA, GATES, SNAPSHOT_INPUTS } = require('./constants');
const { hash, hashFile, read, listFiles, resolveProjectFile } = require('./fsutil');
const { validateSpec } = require('./spec');
const { preflight } = require('./preflight');
const { writeDashboard } = require('./dashboard');

/** Content hash of everything that, when changed, invalidates previous evidence. */
function snapshot(root, manifest) {
  const tracedSources = Object.values(manifest.traceability || {}).flatMap((entry) =>
    (entry.references || []).filter((ref) => ref.kind !== 'evidence').map((ref) => ref.evidence));
  const inputs = [...SNAPSHOT_INPUTS, manifest.requirements,
    ...(manifest.spec ? [manifest.spec.path] : []), ...tracedSources];
  const files = [...new Set(inputs.flatMap((item) => listFiles(path.join(root, item))))].sort();
  return hash(`${manifest.backend}\n${files
    .map((file) => JSON.stringify([path.relative(root, file), hashFile(file)])).join('\n')}`);
}

/** True when the recorded artifact still exists and matches its stored hash. */
function artifactValid(root, entry, key = 'evidence') {
  try {
    return Boolean(entry?.hash) && hashFile(resolveProjectFile(root, entry[key])) === entry.hash;
  } catch { return false; }
}

/** Validate the baselined spec/brief against the files currently on disk. */
function specStatus(root, manifest) {
  if (!manifest.spec) return { issues: ['No spec baseline. Run spec <spec.json> first.'], requirements: [] };
  const issues = [];
  let requirements = [];
  try {
    const file = resolveProjectFile(root, manifest.spec.path);
    requirements = validateSpec(JSON.parse(read(file))).requirements;
    if (hashFile(file) !== manifest.spec.hash) issues.push('Spec changed; rebaseline with an impact report.');
    const brief = resolveProjectFile(root, manifest.requirements);
    if (hashFile(brief) !== manifest.spec.requirementsHash) {
      issues.push('Original requirements changed; review scope and rebaseline the spec.');
    }
    if (manifest.spec.change && !artifactValid(root, manifest.spec.change)) {
      issues.push('Spec change/impact report is missing or changed.');
    }
  } catch (error) { issues.push(`Invalid/missing spec or requirements: ${error.message}`); }
  return { issues, requirements };
}

/** Per-requirement trace state, marking any entry whose evidence went stale. */
function traceStatus(root, manifest, current) {
  const spec = specStatus(root, manifest);
  const requirements = spec.requirements.map((requirement) => {
    const entry = manifest.traceability?.[requirement.id];
    let status = entry?.status || 'pending';
    if (entry && (spec.issues.length || entry.snapshot !== current || !artifactValid(root, entry) ||
        !(entry.references || []).every((ref) => artifactValid(root, ref)))) {
      status = 'stale';
    }
    return {
      id: requirement.id, status,
      description: requirement.description || '', source: requirement.source || '',
      acceptanceCriteria: requirement.acceptanceCriteria || [],
      verification: requirement.verification || 'automated',
      notes: entry?.notes || '', evidence: entry?.evidence || '',
      testRationale: entry?.testRationale || '', references: entry?.references || []
    };
  });
  return {
    specIssues: spec.issues, requirements,
    issues: [...spec.issues, ...requirements.filter((entry) => entry.status !== 'passed')
      .map((entry) => `${entry.id}: ${entry.status}`)]
  };
}

const staleCriteria = (root, manifest, current) => CRITERIA.filter((id) =>
  !artifactValid(root, manifest.acceptance?.[id]) || manifest.acceptance[id].snapshot !== current);

/**
 * Derive the full live report (manifest + computed requirement/gate state).
 * The single place that status, dashboard and watcher all read from.
 */
function buildReport(root, manifest) {
  const current = snapshot(root, manifest);
  const missing = staleCriteria(root, manifest, current);
  const trace = traceStatus(root, manifest, current);
  const report = {
    ...manifest, requirementStatus: trace.requirements, specIssues: trace.specIssues,
    missingOrStaleCriteria: missing,
    sourceChangedSinceVerification: manifest.verification?.snapshot !== current,
    preflight: preflight(root, manifest.backend)
  };
  return { report, trace, missing };
}

/** A manifest that claims `done` is downgraded to `blocked` if any gate no longer holds. */
function guardDoneStatus(root, manifest, { report, trace, missing }) {
  const verification = manifest.verification;
  const logsValid = verification?.checks?.length === GATES.length &&
    verification.checks.every((check) => check.passed && artifactValid(root, check, 'log'));
  if (manifest.status === 'done' && (!verification?.passed || !logsValid || trace.issues.length ||
      missing.length || report.sourceChangedSinceVerification || report.preflight.length)) {
    report.status = 'blocked';
  }
  return report;
}

const EMPTY_REPORT = Object.freeze({
  status: 'not_started', requirements: null, backend: 'none', requirementStatus: [], preflight: []
});

/** Re-render dashboard.html from the current run (or an empty state when none exists). */
function refreshDashboard(root, store) {
  let report;
  try {
    report = buildReport(root, store.load()).report;
  } catch { report = { ...EMPTY_REPORT }; }
  return { htmlPath: writeDashboard(root, report), report };
}

module.exports = {
  snapshot, artifactValid, specStatus, traceStatus, buildReport, guardDoneStatus,
  refreshDashboard, EMPTY_REPORT
};
