'use strict';

const tone = (state) => ({
  done: 'success', passed: 'success', completed: 'success', valid: 'success',
  active: 'info', in_progress: 'info', blocked: 'danger', failed: 'danger',
  stale: 'warning'
}[state] || 'neutral');

function actionTone(action, report) {
  if (action?.state) return tone(action.state);
  if (action?.kind === 'task') {
    const task = report.taskStatus?.find((entry) => action.issue?.startsWith(`${entry.id} ${entry.phase}:`));
    if (task) return tone(task.status);
  }
  if (action?.kind === 'trace') {
    const requirement = report.requirementStatus?.find((entry) => action.issue?.startsWith(`${entry.id}:`));
    if (requirement) return tone(requirement.status);
  }
  if (action?.kind === 'finish') return 'success';
  if (action?.kind === 'preflight') return 'danger';
  if (action?.kind === 'approval' && report.approvalStatus?.status === 'stale') return 'warning';
  if (action?.kind === 'verify' && report.verificationStatus?.status === 'failed') return 'danger';
  if (action?.kind === 'verify' && report.verificationStatus?.status === 'stale') return 'warning';
  if (action?.kind === 'review' && report.missingOrStaleCriteria?.some((id) =>
    report.acceptance?.[id] && action.issue?.startsWith(`${id}:`))) return 'warning';
  if (action?.kind === 'spec' || (action?.kind === 'verify' && report.sourceChangedSinceVerification)) return 'warning';
  return action ? 'info' : (report.status === 'done' ? 'success' : 'neutral');
}

function taskView(report, requirement, phase) {
  const task = report.taskStatus?.find((entry) => entry.id === requirement.id && entry.phase === phase);
  const record = report.tasks?.[requirement.id]?.[phase];
  const trace = report.traceability?.[requirement.id];
  const recordedStatus = task?.recordedStatus || record?.status || (task?.status !== 'stale' ? task?.status : null);
  const tracePassed = !task && (requirement.recordedStatus || trace?.status) === 'passed';
  const state = task?.status || (requirement.status === 'passed' ? 'done' : (tracePassed ? 'stale' : 'pending'));
  const history = tracePassed ? 'Passing trace recorded'
    : ({ done: 'Completion recorded', in_progress: 'In progress declared', blocked: 'Blocker recorded', pending: 'Pending declared' }[recordedStatus] || 'No task record');
  return {
    phase, state, history, at: task?.at || record?.at || (tracePassed ? trace?.at : null),
    completedBefore: recordedStatus === 'done' || tracePassed,
    validity: { done: 'Current', stale: 'Review needed', in_progress: 'Work remaining', blocked: 'Blocked', pending: 'Not completed' }[state] || state,
    notes: task?.notes || ''
  };
}

function stageState(stage, report) {
  const staleRequirements = report.requirementStatus?.some((entry) => entry.status === 'stale');
  const stale = {
    spec: !!report.spec && !!report.specIssues?.length,
    approval: report.approvalStatus?.status === 'stale',
    implementation: report.taskStatus?.some((entry) => entry.phase === 'implementation' && entry.status === 'stale') || staleRequirements,
    testing: report.taskStatus?.some((entry) => entry.phase === 'testing' && entry.status === 'stale') || staleRequirements,
    verify: report.verificationStatus?.status === 'stale',
    done: report.missingOrStaleCriteria?.some((id) => !!report.acceptance?.[id])
  }[stage.id];
  return stale ? 'stale' : stage.status;
}

function presentation(report, pipeline) {
  const actions = report.nextActions || [];
  const currentWork = (report.taskStatus || []).filter(task => task.status === 'in_progress');
  const actionTask = action => (report.taskStatus || []).find(task =>
    (action.requirementId === task.id && action.phase === task.phase) ||
    action.issue?.startsWith(`${task.id} ${task.phase}:`));
  const taskState = action => action.state || actionTask(action)?.status;
  const attention = actions.filter(action =>
    ['spec', 'approval', 'preflight'].includes(action.kind) ||
    ['blocked', 'stale', 'failed'].includes(taskState(action)) ||
    (action.kind === 'trace' && report.requirementStatus?.some(req =>
      ['blocked', 'stale'].includes(req.status) && (action.requirementId === req.id || action.issue?.startsWith(`${req.id}:`)))) ||
    (action.kind === 'verify' && (report.sourceChangedSinceVerification ||
      ['failed', 'stale'].includes(report.verificationStatus?.status))) ||
    (action.kind === 'review' && report.missingOrStaleCriteria?.some(id =>
      report.acceptance?.[id] && action.issue?.startsWith(`${id}:`))));
  const primary = actions.find(action => ['spec', 'approval', 'preflight'].includes(action.kind) ||
    (action.kind === 'verify' && (report.sourceChangedSinceVerification || report.verificationStatus?.status === 'failed'))) ||
    actions.find(action => taskState(action) === 'blocked') ||
    actions.find(action => action.kind === 'task' && taskState(action) !== 'in_progress') ||
    actions.find(action => action.kind !== 'task' && !(action.kind === 'trace' && currentWork.some(task =>
      action.requirementId === task.id || action.issue?.startsWith(`${task.id}:`)))) || null;
  const sourceChanged = primary?.kind === 'verify' && report.sourceChangedSinceVerification;
  const owner = {
    spec: 'Planner', approval: 'Developer', preflight: 'Developer / delivery agent',
    verify: 'Delivery agent', task: 'Implementation owner', trace: 'Requirement owner',
    review: 'Reviewer', finish: 'Delivery lead'
  }[primary?.kind] || (report.status === 'done' ? 'No action required' : 'Developer');
  const hero = {
    title: sourceChanged ? 'Source changed — revalidation needed' : (primary?.issue || (report.status === 'done' ? 'All clear — delivery complete' : (currentWork.length ? 'Continue recorded work' : 'Ready to start'))),
    cause: sourceChanged ? 'Work records are preserved. Completion is blocked until the changed inputs and affected evidence are reviewed again.'
      : (primary?.cause || (report.status === 'done' ? 'Every requirement and required check is current. No rerun is needed.' : (currentWork.length ? 'Complete and review the recorded tasks before declaring them done. No live execution is inferred.' : 'Capture a request, choose a backend and baseline the requirements.'))),
    tone: actionTone(primary, report), owner, command: primary?.commands?.[0] || null,
    copyLabel: primary ? `Copy ${{ approval: 'approve', preflight: 'verify', review: 'accept' }[primary.kind] || primary.kind} command` : null
  };
  const groups = [];
  for (const action of actions.filter(action => action !== primary)) {
    let group = groups.find((entry) => entry.kind === action.kind);
    if (!group) {
      group = { kind: action.kind, label: {
        task: 'Tasks', trace: 'Requirement evidence', review: 'Review attestations',
        verify: 'Automated checks', approval: 'Approval', spec: 'Scope', preflight: 'Prerequisites', finish: 'Completion'
      }[action.kind] || action.kind, actions: [] };
      groups.push(group);
    }
    group.actions.push(action);
  }
  const retained = report.resume?.retained;
  const reusable = retained ? [
    retained.spec && 'spec', retained.approval && 'approval', retained.verification && 'automated checks',
    retained.requirements?.length && `${retained.requirements.length} requirement trace(s)`,
    retained.criteria?.length && `${retained.criteria.length} review(s)`
  ].filter(Boolean) : [];
  const stages = pipeline.stages.map((stage) => {
    const state = stageState(stage, report);
    const declaredProgress = !['stale', 'failed', 'completed'].includes(state) && report.taskStatus?.some((task) =>
      task.phase === stage.id && task.status === 'in_progress');
    const label = declaredProgress ? 'In progress (recorded)'
      : { completed: 'Complete', active: 'Needs attention', pending: 'Not reached', failed: 'Failed', stale: 'Review needed' }[state];
    return { ...stage, state, label, declaredProgress: !!declaredProgress, tone: declaredProgress ? 'info' : tone(state) };
  });
  const requirements = (report.requirementStatus || []).map((requirement) => ({
    ...requirement,
    tasks: ['implementation', 'testing'].map((phase) => taskView(report, requirement, phase)),
    actions: actions.filter((action) => action.requirementId === requirement.id ||
      (!action.requirementId && (action.issue.startsWith(`${requirement.id}:`) || action.issue.startsWith(`${requirement.id} `))))
  }));
  const scopedTasks = requirements.flatMap(requirement =>
    ['implementation', 'testing'].map(phase =>
      report.taskStatus?.find(task => task.id === requirement.id && task.phase === phase)));
  const total = scopedTasks.length;
  const done = scopedTasks.filter(task => task?.status === 'done').length;
  const taskProgress = {
    total, done, remaining: total - done,
    stale: scopedTasks.filter(task => task?.status === 'stale').length,
    percent: total ? Math.floor(done * 100 / total) : null
  };
  const events = [];
  const event = (at, text) => { if (at && Number.isFinite(Date.parse(at))) events.push({ at, text }); };
  event(report.startedAt, 'Request captured');
  event(report.spec?.at, `Spec revision ${report.spec?.revision} baselined`);
  event(report.approved?.at, 'Developer approval recorded');
  for (const task of report.taskStatus || []) {
    const recorded = task.recordedStatus || report.tasks?.[task.id]?.[task.phase]?.status || task.status;
    event(task.at, `${task.id} ${task.phase}: ${recorded} recorded${task.status === 'stale' ? ' — currently stale' : ''}`);
  }
  event(report.verification?.at, `Verification ${report.verification?.passed ? 'PASS' : 'failure'} recorded${report.verificationStatus?.status === 'stale' ? ' — currently stale' : ''}`);
  for (const [id, entry] of Object.entries(report.acceptance || {})) event(entry.at, `${id} review attestation recorded`);
  for (const [id, entry] of Object.entries(report.traceability || {})) event(entry.at, `${id}: ${entry.status} trace recorded`);
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { hero, groups, reusable, stages, requirements, currentWork, attention, taskProgress, events: events.slice(0, 10), primary };
}

module.exports = { presentation, taskView, tone, actionTone };
