'use strict';

const path = require('node:path');
const { CRITERIA, DEFAULT_MODE, MODE_CRITERIA, SHARED_SCOPE, SNAPSHOT_INPUTS } = require('./constants');
const { hash, hashFile, read, listFiles, resolveProjectFile } = require('./fsutil');
const { validateSpec } = require('./spec');
const { preflightDetail } = require('./preflight');
const { activeGates } = require('./gates');
const { writeDashboard } = require('./dashboard');
const { featureIssues } = require('./features');

/** Delivery mode baselined in the spec (hash-bound to approval). */
const modeOf = (manifest) => manifest.spec?.mode || DEFAULT_MODE;

/** Global attestations required for this run's mode. */
const criteriaFor = (manifest) => MODE_CRITERIA[modeOf(manifest)] || CRITERIA;

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

/** Hash of inputs shared by every requirement (platform, backend config, lib/core, brief, spec). */
function sharedSnapshot(root, manifest) {
  const inputs = [...SHARED_SCOPE, manifest.requirements, ...(manifest.spec ? [manifest.spec.path] : [])];
  const files = [...new Set(inputs.flatMap((item) => listFiles(path.join(root, item))))].sort();
  return hash(`${manifest.backend}\n${files
    .map((file) => JSON.stringify([path.relative(root, file), hashFile(file)])).join('\n')}`);
}

/**
 * Freshness fingerprint for ONE requirement: the shared inputs plus only the
 * implementation/test files linked from that requirement's trace. Editing an
 * unrelated feature does not invalidate this requirement's evidence.
 */
function requirementSnapshot(root, manifest, id, shared = sharedSnapshot(root, manifest)) {
  const linked = (manifest.traceability?.[id]?.references || [])
    .filter((ref) => ref.kind !== 'evidence').map((ref) => ref.evidence);
  const files = [...new Set(linked.flatMap((item) => listFiles(path.join(root, item))))].sort();
  return hash(`${shared}\n${files
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
    requirements = validateSpec(JSON.parse(read(file)), { legacy: true }).requirements;
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
  const shared = spec.issues.length ? null : sharedSnapshot(root, manifest);
  const requirements = spec.requirements.map((requirement) => {
    const entry = manifest.traceability?.[requirement.id];
    let status = entry?.status || 'pending';
    // Entries recorded before per-requirement scoping fall back to the global snapshot.
    const fresh = entry && (entry.scopeSnapshot
      ? entry.scopeSnapshot === requirementSnapshot(root, manifest, requirement.id, shared)
      : entry.snapshot === current);
    if (entry && (spec.issues.length || !fresh || !artifactValid(root, entry) ||
        !(entry.references || []).every((ref) => artifactValid(root, ref)))) {
      status = 'stale';
    }
    return {
      id: requirement.id, status, recordedStatus: entry?.status || null, recordedAt: entry?.at || null,
      description: requirement.description || '', source: requirement.source || '',
      feature: requirement.feature || null,
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

const staleCriteria = (root, manifest, current) => criteriaFor(manifest).filter((id) =>
  !artifactValid(root, manifest.acceptance?.[id]) || manifest.acceptance[id].snapshot !== current);

function approvalStatus(root, manifest, spec = specStatus(root, manifest)) {
  const approval = manifest.approved;
  const baseline = manifest.spec;
  const valid = !!baseline && !!approval?.at && Number.isFinite(Date.parse(approval.at)) &&
    approval.specRevision === baseline.revision && approval.specHash === baseline.hash &&
    approval.requirementsHash === baseline.requirementsHash && spec.issues.length === 0;
  return {
    status: valid ? 'valid' : (approval ? 'stale' : 'missing'),
    valid,
    issues: valid ? [] : [
      approval
        ? 'Developer approval is stale or unbound. Review the current spec and run approve again.'
        : 'Developer approval is missing. Review the current spec and run approve.'
    ]
  };
}

function verificationStatus(root, manifest, current, gates) {
  const verification = manifest.verification;
  const issues = [];
  if (!verification?.passed || verification.snapshot !== current) {
    issues.push('A passing verify for current inputs is required.');
  }
  const checks = verification?.checks || [];
  if (verification && (checks.length !== gates.length ||
      !gates.every((gate) => checks.filter((check) => check.name === gate.name && check.passed).length === 1))) {
    issues.push(`A passing verify with all ${gates.map((gate) => gate.name).join('/')} gates is required.`);
  }
  for (const check of checks) {
    try {
      if (!check.hash) issues.push(`Missing ${check.name} execution-log hash. Run verify again.`);
      else if (hashFile(resolveProjectFile(root, check.log)) !== check.hash) issues.push(`Changed ${check.name} execution log.`);
    } catch { issues.push(`Missing ${check.name} execution log.`); }
  }
  return {
    status: !verification ? 'missing' : (issues.length ? (verification.passed ? 'stale' : 'failed') : 'valid'),
    valid: issues.length === 0, issues,
    checks: gates.map(({ name }) => {
      const matches = checks.filter((check) => check.name === name);
      const check = matches[0];
      const status = !check ? 'pending'
        : (matches.length !== 1 || verification.snapshot !== current || !artifactValid(root, check, 'log')
          ? 'stale' : (check.passed ? 'passed' : 'failed'));
      return { name, status };
    })
  };
}

function taskStatus(manifest, current, specIssues) {
  return (manifest.spec?.ids || []).flatMap((id) =>
    Object.entries(manifest.tasks?.[id] || {}).map(([phase, entry]) => {
      const stale = specIssues.length > 0 || entry.specRevision !== manifest.spec.revision ||
        entry.specHash !== manifest.spec.hash || entry.requirementsHash !== manifest.spec.requirementsHash ||
        (entry.status === 'done' && entry.snapshot !== current);
      return { ...entry, id, phase, recordedStatus: entry.status, status: stale ? 'stale' : entry.status };
    }));
}

const command = (args) => `node .agents/runtime/crew.js ${args}`;
const quote = (value) => JSON.stringify(value);

function nextActions(report) {
  const actions = [];
  const add = (kind, issue, cause, commands, context = {}) =>
    actions.push({ kind, issue, cause, commands: commands.map(command), ...context });
  if (report.specIssues.length) {
    add('spec', 'Spec baseline needs attention', report.specIssues.join(' '),
      [report.spec ? `spec ${quote(report.spec.path)} <reviewed-impact.md>` : 'spec <spec.json>']);
  }
  if (!report.approvalStatus.valid) {
    add('approval', 'Developer approval required', report.approvalStatus.issues.join(' '), ['approve "<developer decision>"']);
  }
  if (report.preflight.length) {
    add('preflight', 'Project prerequisites are blocked', report.preflight.join(' '), ['verify']);
  }
  if (report.sourceChangedSinceVerification) {
    add('verify', 'Source changed',
      'Inputs changed since verification. Re-run verify and review stale traces/attestations.', ['verify']);
  }
  for (const entry of report.taskStatus.filter((entry) => entry.status !== 'done')) {
    add('task', `${entry.id} ${entry.phase}: ${entry.status}`, entry.notes,
      [`task ${entry.id} ${entry.phase} ${entry.status === 'in_progress' ? 'done "<completed work>"' : 'in_progress "<remaining work>"'}`],
      { requirementId: entry.id, phase: entry.phase, state: entry.status });
  }
  for (const entry of report.requirementStatus.filter((entry) => entry.status !== 'passed')) {
    add('trace', `${entry.id}: ${entry.status}`,
      entry.status === 'stale' ? 'Source, spec, trace report or linked evidence changed; inspect and revalidate this requirement.'
        : (entry.notes || 'Implement and test this requirement, then record reviewed evidence.'),
      [`trace ${entry.id} ${entry.evidence ? quote(entry.evidence) : '<trace.json>'}`,
        ...(report.verificationStatus.valid ? [`trace --auto ${entry.id}`] : [])],
      { requirementId: entry.id, state: entry.status });
  }
  if (!report.verificationStatus.valid && !report.sourceChangedSinceVerification) {
    add('verify', 'Verification required', report.verificationStatus.issues.join(' '), ['verify']);
  }
  for (const id of report.missingOrStaleCriteria) {
    const entry = report.acceptance?.[id];
    add('review', `${id}: ${entry ? 'stale' : 'missing'} review`,
      'Review current source and evidence before recording the attestation.',
      [`accept ${id} ${entry ? quote(entry.evidence) : '<reviewed-evidence.md>'}`,
        ...(entry ? [] : [`accept --draft ${id}`])],
      { criterionId: id, state: entry ? 'stale' : 'pending' });
  }
  // Syncing before every ID passes would only record interim statuses.
  if (report.featureIssues.length && report.requirementStatus.every((entry) => entry.status === 'passed')) {
    add('feature', 'Feature catalog needs update', report.featureIssues.join(' '), ['feature sync']);
  }
  if (!actions.length && report.status !== 'done') {
    add('finish', 'Ready to finish', 'All required evidence is current.', ['finish']);
  }
  return actions;
}

/**
 * Derive the full live report (manifest + computed requirement/gate state).
 * The single place that status, dashboard and watcher all read from.
 */
function buildReport(root, manifest) {
  const current = snapshot(root, manifest);
  const missing = staleCriteria(root, manifest, current);
  const trace = traceStatus(root, manifest, current);
  const approval = approvalStatus(root, manifest, { issues: trace.specIssues });
  const gates = activeGates(root);
  const verification = verificationStatus(root, manifest, current, gates);
  const tasks = taskStatus(manifest, current, trace.specIssues);
  const { issues: prerequisiteFindings, suppressed } = preflightDetail(root, manifest.backend);
  const prerequisites = prerequisiteFindings.map((entry) => entry.message);
  const acceptanceIssues = missing.map((id) =>
    `${manifest.acceptance?.[id] && !artifactValid(root, manifest.acceptance[id]) ? 'Invalid' : 'Missing/stale'} ${id} evidence.`);
  const catalog = trace.specIssues.length ? [] : featureIssues(root, trace.requirements);
  const issues = [...prerequisites, ...trace.issues, ...approval.issues, ...verification.issues,
    ...acceptanceIssues, ...tasks.filter((entry) => entry.status !== 'done')
      .map((entry) => `${entry.id} ${entry.phase}: ${entry.status}`), ...catalog];
  const invalidated = manifest.status === 'done' || manifest.status === 'blocked' ||
    approval.status === 'stale' || verification.status === 'stale' || verification.status === 'failed' ||
    missing.some((id) => !!manifest.acceptance?.[id]) ||
    tasks.some((entry) => entry.status === 'blocked' || entry.status === 'stale') ||
    trace.requirements.some((entry) => entry.status === 'blocked' || entry.status === 'stale');
  const report = {
    ...manifest, requirementStatus: trace.requirements, specIssues: trace.specIssues,
    status: issues.length ? (invalidated ? 'blocked' : 'in_progress')
      : (manifest.status === 'done' ? 'done' : 'in_progress'),
    mode: modeOf(manifest), criteria: criteriaFor(manifest), gates,
    missingOrStaleCriteria: missing,
    sourceChangedSinceVerification: !!manifest.verification && manifest.verification.snapshot !== current,
    preflight: prerequisites, preflightSuppressed: suppressed,
    approvalStatus: approval, verificationStatus: verification,
    taskStatus: tasks, featureIssues: catalog, completionIssues: issues
  };
  report.nextActions = nextActions(report);
  report.nextAction = report.nextActions[0] || null;
  report.resume = {
    retained: {
      spec: trace.specIssues.length === 0,
      approval: approval.valid,
      verification: verification.valid,
      requirements: trace.requirements.filter((entry) => entry.status === 'passed').map((entry) => entry.id),
      criteria: criteriaFor(manifest).filter((id) => !missing.includes(id)),
      tasks: tasks.filter((entry) => entry.status === 'done').map(({ id, phase }) => ({ id, phase }))
    },
    remaining: report.nextActions
  };
  return { report, trace, missing };
}

const EMPTY_REPORT = Object.freeze({
  status: 'not_started', requirements: null, backend: 'none', requirementStatus: [], preflight: []
});

/** Re-render dashboard.html from the current run (or an empty state when none exists). */
function refreshDashboard(root, store) {
  const report = store.exists() ? buildReport(root, store.load()).report : { ...EMPTY_REPORT };
  return { htmlPath: writeDashboard(root, report), report };
}

module.exports = {
  snapshot, requirementSnapshot, sharedSnapshot, artifactValid, specStatus, traceStatus,
  approvalStatus, buildReport, refreshDashboard, criteriaFor, modeOf, EMPTY_REPORT
};
