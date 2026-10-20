'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generateDashboardHtml, writeDashboard } = require('../.agents/runtime/dashboard');
const { clientScript } = require('../.agents/runtime/dashboard/client');
const { presentation, taskView, actionTone } = require('../.agents/runtime/dashboard/presentation');
const { derivePipeline } = require('../.agents/runtime/pipeline');

const panel = (html, id) => html.match(new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?</section>`))[0];
const requirement = { id: 'REQ-001', description: 'Counter', status: 'passed', acceptanceCriteria: ['Increment once'] };

test('completed actions and tasks use success styling, not the warning component', () => {
  const html = generateDashboardHtml({
    status: 'done', nextActions: [],
    requirementStatus: [requirement],
    taskStatus: [{ id: 'REQ-001', phase: 'implementation', status: 'done', notes: 'Completed work' }]
  });
  for (const id of ['requirements-panel']) {
    const content = panel(html, id);
    assert.match(content, /tone-success/);
    assert.doesNotMatch(content, /warning-item|tone-warning/);
  }
  assert.match(html, /Complete — no work in progress/);
});

test('task colors distinguish done, ongoing, stale, blocked and pending', () => {
  for (const [status, tone] of [
    ['done', 'success'], ['in_progress', 'info'], ['stale', 'warning'],
    ['blocked', 'danger'], ['pending', 'neutral']
  ]) {
    const html = generateDashboardHtml({
      requirementStatus: [requirement],
      taskStatus: [{ id: 'REQ-001', phase: 'testing', status, notes: '<script>unsafe</script>' }]
    });
    const content = panel(html, 'requirements-panel');
    assert.match(content, new RegExp(`task-record tone-${tone}`));
    assert.match(content, /&lt;script&gt;unsafe&lt;\/script&gt;/);
    assert.doesNotMatch(content, /<script>/);
  }
});

test('next actions distinguish ready-to-finish, blocked and informational actions', () => {
  for (const [kind, tone] of [['finish', 'success'], ['preflight', 'danger'], ['approval', 'info'], ['spec', 'warning']]) {
    const html = generateDashboardHtml({
      nextActions: [{ kind, issue: 'Action', cause: 'Cause', commands: ['command'] }]
    });
    assert.match(html, new RegExp(`action-row tone-${tone}`));
  }
  assert.doesNotMatch(generateDashboardHtml({ status: 'not_started' }), /id="needs-attention"/);
});

test('overview moves counts into their context and uses one compact stepper', () => {
  const html = generateDashboardHtml({ status: 'not_started' });
  assert.equal((html.match(/class="metric-card /g) || []).length, 0);
  for (const label of ['Pipeline Lifecycle', 'Requirements &amp; work', 'Automated Checks', 'Review Attestations']) {
    assert.ok(html.includes(label));
  }
  assert.equal((html.match(/class="stage-card /g) || []).length, 7);
  assert.doesNotMatch(html, /stage-panel-|stage-detail|selectStage|aria-expanded=/);
  assert.doesNotMatch(html, /id="recorded-tasks-panel"/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(html, /animation: none !important/);
  assert.match(html, /data-motion-key="stage:implementation"/);
  assert.doesNotMatch(html, /stage-picker|mobile-stage-picker/);
  assert.equal((html.match(/class="stage-link"/g) || []).length, 6);
  assert.equal((html.match(/aria-current="step"/g) || []).length, 1);
  assert.equal((html.match(/class="stage-focus"/g) || []).length, 1);
  assert.match(html, /CURRENT marks workflow focus, not live execution/);
  assert.match(html, /@keyframes connect-stages/);
  assert.match(html, /@keyframes focus-stage/);
  assert.match(html, /animation: recorded-progress 2.4s ease-in-out infinite/);
  assert.match(html, /font: 14px\/1.6 var\(--mono\)/);
});

test('one primary action groups all remaining work without dropping items', () => {
  const actions = [
    { kind: 'verify', issue: 'Source changed', cause: 'Changed inputs', commands: ['node crew.js verify'] },
    ...['implementation', 'testing'].map((phase) => ({
      kind: 'task', issue: `REQ-001 ${phase}: stale`, cause: phase, commands: [`task ${phase}`], requirementId: 'REQ-001', state: 'stale'
    })),
    { kind: 'trace', issue: 'REQ-001: stale', cause: 'Evidence stale', commands: ['trace REQ-001'], requirementId: 'REQ-001' },
    ...['requirements', 'design', 'backend', 'security', 'experience'].map((id) => ({
      kind: 'review', issue: `${id}: stale review`, cause: id, commands: [`accept ${id}`]
    }))
  ];
  const report = { sourceChangedSinceVerification: true, nextActions: actions, status: 'blocked',
    resume: { retained: { spec: true, approval: true, requirements: [], criteria: [], verification: false } } };
  const view = presentation(report, derivePipeline(report));
  assert.equal(view.hero.command, actions[0].commands[0]);
  assert.deepEqual(view.reusable, ['spec', 'approval']);
  assert.deepEqual(view.groups.map((group) => [group.kind, group.actions.length]), [['task', 2], ['trace', 1], ['review', 5]]);
  const html = generateDashboardHtml(report);
  assert.match(html, /Copy command/);
  assert.match(html, /id="needs-attention"/);
  assert.match(html, /id="remaining-work"><summary>Remaining work \(9\)/);
  assert.doesNotMatch(html, /id="remaining-work" open/);
  assert.ok(html.indexOf('id="work-overview"') < html.indexOf('id="pipeline-panel"'));
  for (const action of actions.slice(1)) assert.ok(html.includes(action.issue));
});

test('pipeline keeps seven stages in a connected three-column snake on every screen without reordering the DOM', () => {
  const html = generateDashboardHtml({});
  const ids = [...html.matchAll(/id="step-([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ['intake', 'spec', 'approval', 'implementation', 'testing', 'verify', 'done']);
  assert.match(html, /\.pipeline-grid \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.equal((html.match(/\.pipeline-grid \{/g) || []).length, 1);
  for (const [stage, row, column] of [[1, 1, 1], [2, 1, 2], [3, 1, 3], [4, 2, 3], [5, 2, 2], [6, 2, 1], [7, 3, 1]]) {
    assert.ok(html.includes(`.pipeline-grid li:nth-child(${stage}) { grid-area: ${row} / ${column}; }`));
  }
  assert.match(html, /nth-child\(4\), :nth-child\(5\)\) \.stage-link \{ left: auto; right: 100%;/);
  assert.equal((html.match(/class="stage-link"/g) || []).length, 6);
});

test('work-first reading order keeps pipeline before evidence and context last', () => {
  for (const status of ['not_started', 'in_progress', 'blocked', 'done']) {
    const html = generateDashboardHtml({ status });
    const ids = ['work-overview', 'requirements-panel', 'pipeline-panel', 'verification-panel', 'recent-activity', 'run-context'];
    const positions = ids.map((id) => html.indexOf(`id="${id}"`));
    assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])));
    assert.match(html, /class="stage-summary" href="#pipeline-panel"/);
    assert.equal((html.match(/class="stage-card /g) || []).length, 7);
    assert.ok(html.indexOf('id="pipeline-panel"') < html.indexOf('</aside>'));
    assert.ok(html.indexOf('</main>') < html.indexOf('id="recent-activity"'));
    assert.doesNotMatch(html, /id="(?:run-context|recent-activity)" open/);
  }
});

test('normal pending work has no attention banner but retains all actions', () => {
  const html = generateDashboardHtml({ nextActions: [
    { kind: 'verify', issue: 'Verify', cause: 'Source needs checking', commands: ['verify'] },
    { kind: 'review', issue: 'Review', cause: 'Review needed', commands: ['accept'] }
  ] });
  assert.doesNotMatch(html, /id="needs-attention"|id="next-action-panel"/);
  assert.match(html, /Source needs checking/);
  assert.match(html, /id="remaining-work"><summary>Remaining work \(2\)/);
});

test('attention is conditional and never drops remaining actions or completion commands', () => {
  for (const state of ['pending', 'in_progress', 'done']) {
    const html = generateDashboardHtml({ taskStatus: [{ id: requirement.id, phase: 'testing', status: state }],
      nextActions: state === 'done' ? [] : [{ kind: 'task', state, issue: 'Task', cause: 'Work', commands: ['task'] }] });
    assert.doesNotMatch(html, /id="needs-attention"/);
  }
  for (const state of ['blocked', 'stale', 'failed']) {
    const html = generateDashboardHtml({ nextActions: [{ kind: 'task', state, issue: state, cause: 'Investigate', commands: ['task'] }] });
    assert.match(html, /id="needs-attention"/);
    assert.match(html, /id="remaining-work"><summary>Remaining work \(1\)/);
  }
  const finished = generateDashboardHtml({ nextActions: [{ kind: 'finish', issue: 'Ready', commands: ['finish'] }] });
  assert.doesNotMatch(finished, /id="needs-attention"/);
  assert.match(finished.slice(0, finished.indexOf('</header>')), /data-command="finish"/);
});

test('current work is separate from prioritized blockers without losing canonical actions', () => {
  const taskStatus = [
    { id: 'REQ-001', phase: 'testing', status: 'in_progress' },
    { id: 'REQ-002', phase: 'implementation', status: 'in_progress' },
    { id: 'REQ-003', phase: 'implementation', status: 'blocked' }
  ];
  const actions = taskStatus.map(task => ({
    kind: 'task', requirementId: task.id, phase: task.phase, state: task.status,
    issue: `${task.id} ${task.phase}: ${task.status}`, cause: 'Recorded fixture', commands: ['task']
  }));
  const report = { taskStatus, nextActions: actions };
  const view = presentation(report, derivePipeline(report));
  assert.equal(view.currentWork.length, 2);
  assert.equal(view.primary.requirementId, 'REQ-003');
  assert.equal(view.groups.flatMap(group => group.actions).length, 2);
  assert.equal(report.nextActions[0], actions[0]);
  const html = generateDashboardHtml(report);
  assert.match(html, /href="#req-REQ-001"/);
  assert.ok(html.indexOf('id="current-work"') < html.indexOf('id="needs-attention"'));
  const prerequisite = { kind: 'approval', issue: 'Approval required', commands: ['approve'] };
  assert.equal(presentation({ ...report, nextActions: [...actions, prerequisite] }, derivePipeline(report)).primary, prerequisite);
});

test('current work handles overflow, empty, done and stale task records honestly', () => {
  const tasks = ['REQ-001', 'REQ-002', 'REQ-003'].map(id => ({ id, phase: 'testing', status: 'in_progress' }));
  const html = generateDashboardHtml({ taskStatus: tasks });
  assert.match(html, /id="more-current-work"><summary>\+1 more/);
  assert.match(generateDashboardHtml({}), /No work recorded in progress/);
  assert.match(generateDashboardHtml({ status: 'done' }), /Complete — no work in progress/);
  const stale = presentation({ taskStatus: [{ ...tasks[0], status: 'stale', recordedStatus: 'in_progress' }] }, { stages: [] });
  assert.equal(stale.currentWork.length, 0);
  const action = { kind: 'task', issue: 'REQ-001 testing: in_progress', commands: ['task'], state: 'in_progress' };
  const view = presentation({ taskStatus: [tasks[0]], nextActions: [action] }, { stages: [] });
  assert.equal(view.primary, null);
  assert.equal(view.hero.title, 'Continue recorded work');
  assert.equal(view.hero.command, null);
  assert.equal(view.groups[0].actions[0], action);
});

test('stage labels separate completion, workflow focus and declared progress', () => {
  const pipeline = { stages: [{ id: 'approval', status: 'completed' }, { id: 'testing', status: 'active' }] };
  const report = { taskStatus: [{ id: 'REQ-001', phase: 'testing', status: 'in_progress' }] };
  assert.deepEqual(presentation(report, pipeline).stages.map((stage) => stage.label), ['Complete', 'In progress (recorded)']);
  assert.equal(presentation({}, pipeline).stages[1].label, 'Needs attention');
  const html = generateDashboardHtml({ status: 'done' });
  assert.doesNotMatch(html, /class="stage-focus"|data-focus="true"/);
});

test('progress indicators require recorded in-progress work, including secondary active phases', () => {
  const report = {
    requirementStatus: [{ ...requirement, status: 'pending' }],
    taskStatus: [{ id: requirement.id, phase: 'testing', status: 'in_progress' }],
    nextActions: [{ kind: 'task', state: 'in_progress', issue: 'REQ-001 testing: in_progress', cause: 'Recorded', commands: ['task'] }]
  };
  const html = generateDashboardHtml(report);
  for (const key of ['current-work', 'req:REQ-001', 'task:REQ-001:testing', 'stage:testing']) {
    assert.ok(html.includes(`data-progress-key="${key}"`));
  }
  assert.match(html, /TODO 1/);
  const secondary = presentation(report, { stages: [{ id: 'testing', status: 'pending' }] });
  assert.equal(secondary.stages[0].declaredProgress, true);
  for (const status of ['pending', 'blocked', 'stale', 'done']) {
    const rendered = generateDashboardHtml({ requirementStatus: [requirement],
      taskStatus: [{ id: requirement.id, phase: 'testing', status }] });
    assert.doesNotMatch(rendered, /data-progress-key="(?:primary-task|req:|task:|stage:)/);
  }
});

test('current pipeline node pulses continuously without requiring entry or update classes', () => {
  const html = generateDashboardHtml({});
  assert.match(html, /\.stage-card\[data-focus=true\] \.stage-number \{ animation: focus-stage 2.4s var\(--ease\) infinite;/);
  assert.match(html, /data-progress-key="focus:intake"/);
  assert.doesNotMatch(generateDashboardHtml({ status: 'done' }), /data-progress-key="focus:/);
});

test('stale completion history stays distinct from current validity, including old saved reports', () => {
  const r = { ...requirement, status: 'stale' };
  const report = {
    requirementStatus: [r],
    tasks: { 'REQ-001': { implementation: { status: 'done', at: '2026-01-01T10:00:00Z' } } },
    taskStatus: [{ id: r.id, phase: 'implementation', status: 'stale', at: '2026-01-01T10:00:00Z' }]
  };
  const task = taskView(report, r, 'implementation');
  assert.equal(task.history, 'Completion recorded');
  assert.equal(task.state, 'stale');
  assert.equal(task.validity, 'Review needed');
  const html = generateDashboardHtml(report);
  assert.match(html, /Completion recorded/);
  assert.match(html, /Current validity: <strong>Review needed/);
  assert.match(html, /Evidence stale/);
  assert.doesNotMatch(html, /class="task-record tone-success"/);
});

test('source changes do not override an earlier spec or approval prerequisite', () => {
  for (const kind of ['spec', 'approval', 'preflight']) {
    const report = { sourceChangedSinceVerification: true, nextActions: [
      { kind, issue: `${kind} first`, cause: 'Resolve prerequisite', commands: [`resolve ${kind}`] },
      { kind: 'verify', issue: 'Source changed', cause: 'Recheck', commands: ['verify'] }
    ] };
    const view = presentation(report, derivePipeline(report));
    assert.equal(view.hero.title, `${kind} first`);
    assert.equal(view.hero.command, `resolve ${kind}`);
    assert.equal(view.groups[0].kind, 'verify');
  }
});

test('action tones distinguish stale approval, failed checks and historical review records', () => {
  assert.equal(actionTone({ kind: 'approval' }, { approvalStatus: { status: 'stale' } }), 'warning');
  assert.equal(actionTone({ kind: 'verify' }, { verificationStatus: { status: 'failed' } }), 'danger');
  assert.equal(actionTone({ kind: 'verify' }, { verificationStatus: { status: 'stale' } }), 'warning');
  assert.equal(actionTone({ kind: 'review', state: 'pending' }, {}), 'neutral');
  assert.equal(actionTone({ kind: 'review', issue: 'security: stale review' }, {
    missingOrStaleCriteria: ['security'], acceptance: { security: { at: '2026-01-01T10:00:00Z' } }
  }), 'warning');
  assert.equal(actionTone({ kind: 'task', issue: 'REQ-001 testing: stale' }, {
    taskStatus: [{ id: 'REQ-001', phase: 'testing', status: 'stale' }]
  }), 'warning');
  assert.equal(actionTone({ kind: 'trace', issue: 'REQ-001: stale' }, {
    requirementStatus: [{ id: 'REQ-001', status: 'stale' }]
  }), 'warning');
});

test('unknown stale work does not invent a completion record or running process', () => {
  const report = { taskStatus: [{ id: requirement.id, phase: 'implementation', status: 'stale' }] };
  const task = taskView(report, requirement, 'implementation');
  assert.equal(task.completedBefore, false);
  assert.equal(task.history, 'No task record');
  const html = generateDashboardHtml({ requirementStatus: [requirement], ...report });
  assert.doesNotMatch(html, /Running|is executing|active-beat/);
});

test('evidence distinguishes no record, current and stale instead of marking all missing entries stale', () => {
  const missing = generateDashboardHtml({});
  assert.equal((missing.match(/>MISSING<\/span>/g) || []).length, 5);
  assert.equal((missing.match(/>STALE<\/span>/g) || []).length, 0);
  const stale = generateDashboardHtml({
    verification: { passed: true, at: '2026-01-01T10:00:00Z', checks: [{ name: 'tests', passed: true }] },
    verificationStatus: { valid: false, status: 'stale', checks: [{ name: 'tests', status: 'stale' }] },
    acceptance: { backend: { at: '2026-01-01T10:00:00Z', evidence: 'backend.txt' } }, missingOrStaleCriteria: ['backend']
  });
  assert.match(stale, /gate-stale">STALE/);
  assert.match(stale, /PASS recorded/);
  assert.match(stale, /Current validity: stale/);
});

test('primary command and titles are escaped rather than executable markup', () => {
  const html = generateDashboardHtml({ nextActions: [{
    kind: 'verify', issue: '<img src=x onerror=alert(1)>', cause: '<script>bad</script>',
    commands: ['verify "</textarea><script>bad</script>"']
  }] });
  assert.doesNotMatch(html, /<img src=x|<script>bad/);
  assert.match(html, /&lt;\/textarea&gt;&lt;script&gt;bad/);
  assert.match(html, /data-command="verify &quot;/);
});

function element(extra = {}) {
  const classes = new Set();
  return {
    dataset: {}, style: { setProperty() {} }, checked: true, open: true, value: '',
    classList: {
      add: (value) => classes.add(value), remove: (value) => classes.delete(value),
      contains: (value) => classes.has(value),
      toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value)
    },
    addEventListener() {}, focus() {}, select() {}, scrollIntoView() {}, setAttribute(name, value) { this[name] = value; }, matches: () => false,
    ...extra
  };
}

function boot({ saved = null, value = '1 / 7', reduced = false, navigation = 'navigate', storageError = false, runKey = 'run-1', clipboard = async () => {}, pipelineFocus = 'implementation' } = {}) {
  let stored = saved && JSON.stringify(saved);
  const warnings = [];
  const timeouts = [];
  const intervals = new Map();
  const metric = element({ dataset: { motionKey: 'metric:stages', motionValue: value } });
  const task = element({ dataset: { motionKey: 'task:one', motionValue: 'done' } });
  const progress = element({ dataset: { progressKey: 'task:one' } });
  const offsets = {};
  progress.style.setProperty = (key, value) => { offsets[key] = value; };
  const req = element({
    dataset: { id: 'REQ-001' }, textContent: 'REQ-001 counter',
    getAttribute: () => 'passed'
  });
  const filters = ['all', 'passed', 'pending', 'stale', 'blocked'].map((filter) => element({ dataset: { filter } }));
  const stageButtons = ['implementation', 'verify'].map((stage) => element({ dataset: { stage } }));
  const stagePanels = ['implementation', 'verify'].map((stage) => element({ id: `stage-panel-${stage}`, hidden: stage !== pipelineFocus }));
  const ids = {
    autoRefreshToggle: element(), refreshButton: element(), 'requirement-search': element(),
    lastUpdatedText: element(), reqEmptyMsg: element(),
    'copy-command': element({ dataset: { command: 'node crew.js verify' } }),
    'copy-feedback': element(), 'manual-copy': element({ hidden: true }), 'manual-command': element(),
    ...Object.fromEntries(stagePanels.map((entry) => [entry.id, entry]))
  };
  const document = {
    body: { dataset: { runKey, currentStage: pipelineFocus } }, activeElement: element(),
    getElementById: (id) => ids[id] || null,
    querySelectorAll: (selector) => ({
      '[data-motion-key]': [metric, task], details: [req], '.req-card': [req],
      '[data-progress-key]': [progress],
      '.filter-chip': filters, '.req-summary': [],
      '.stage-detail': stagePanels, '.stage-card[data-stage]': stageButtons
    }[selector] || [])
  };
  const window = {
    scrollY: 0, addEventListener() {},
    scrollTo(_x, y) { this.scrollY = y; }
  };
  let reloads = 0;
  const context = {
    document, window,
    console: { warn: (...args) => warnings.push(args) },
    location: { pathname: '/dashboard.html', reload: () => reloads++ },
    history: {},
    performance: { getEntriesByType: () => [{ type: navigation }] },
    matchMedia: () => ({ matches: reduced }),
    navigator: { clipboard: { writeText: clipboard } },
    sessionStorage: {
      getItem() { if (storageError) throw new Error('Storage disabled'); return stored; },
      setItem(_key, item) { if (storageError) throw new Error('Storage disabled'); stored = item; }
    },
    setTimeout: (callback) => timeouts.push(callback),
    setInterval: (callback) => { const id = intervals.size + 1; intervals.set(id, callback); return id; },
    clearInterval: (id) => intervals.delete(id)
  };
  vm.runInNewContext(clientScript(), context);
  return { context, document, window, metric, task, offsets, req, ids, filters, stageButtons, stagePanels, warnings, timeouts, intervals,
    preferences: () => JSON.parse(stored), reloads: () => reloads };
}

test('entry animation runs once; unchanged refresh does not animate; changed values do', () => {
  const first = boot();
  assert.equal(first.metric.classList.contains('is-entering'), true);
  const unchanged = boot({ saved: first.preferences(), navigation: 'reload' });
  assert.equal(unchanged.metric.classList.contains('is-entering'), false);
  assert.equal(unchanged.metric.classList.contains('is-updated'), false);
  const changed = boot({ saved: first.preferences(), navigation: 'reload', value: '2 / 7' });
  assert.equal(changed.metric.classList.contains('is-updated'), true);
  assert.equal(changed.task.classList.contains('is-updated'), false);
});

test('recorded progress retains animation phase on refresh rather than restarting', () => {
  const page = boot();
  const saved = page.preferences();
  assert.ok(Number.isFinite(saved.progressStarts['task:one']));
  saved.progressStarts['task:one'] -= 1100;
  const next = boot({ saved });
  assert.equal(next.preferences().progressStarts['task:one'], saved.progressStarts['task:one']);
  assert.match(next.offsets['--progress-offset'], /^-\d+ms$/);
  assert.notEqual(next.offsets['--progress-offset'], '-0ms');
});

test('reduced motion suppresses entry and change effects', () => {
  assert.equal(boot({ reduced: true }).metric.classList.contains('is-entering'), false);
  const saved = boot().preferences();
  assert.equal(boot({ saved, value: '2 / 7', reduced: true }).metric.classList.contains('is-updated'), false);
});

test('refresh preserves search, filters, open state, scroll and the auto-refresh preference', () => {
  const first = boot();
  first.req.open = false;
  first.window.scrollY = 400;
  first.context.searchReqs('COUNTER');
  first.context.filterReqs('passed', first.filters[1]);
  first.context.toggleAutoRefresh(false);
  const restored = boot({ saved: first.preferences(), navigation: 'reload' });
  assert.equal(restored.req.open, false);
  assert.equal(restored.window.scrollY, 400);
  assert.equal(restored.ids['requirement-search'].value, 'COUNTER');
  assert.equal(restored.filters[1].classList.contains('active'), true);
  assert.equal(restored.ids.autoRefreshToggle.checked, false);
  assert.equal(restored.intervals.size, 0);
});

test('a new run does not inherit the previous run view or animation state', () => {
  const first = boot();
  first.context.searchReqs('old query');
  first.context.toggleAutoRefresh(false);
  const next = boot({ saved: first.preferences(), runKey: 'run-2' });
  assert.equal(next.ids['requirement-search'].value, '');
  assert.equal(next.ids.autoRefreshToggle.checked, true);
  assert.equal(next.metric.classList.contains('is-entering'), true);
});

test('unavailable storage warns explicitly without breaking controls or replaying entry on reload', () => {
  const page = boot({ storageError: true, navigation: 'reload' });
  assert.equal(page.warnings.length, 1);
  assert.equal(page.metric.classList.contains('is-entering'), false);
  page.context.toggleAutoRefresh(false);
  assert.equal(page.intervals.size, 0);
});

test('auto-refresh pauses while typing and schedules only one reload at a time', () => {
  const page = boot();
  const tick = [...page.intervals.values()][0];
  page.document.activeElement = element({ matches: () => true });
  tick();
  assert.equal(page.timeouts.length, 0);
  page.document.activeElement = element();
  tick();
  tick();
  assert.equal(page.timeouts.length, 1);
  assert.equal(page.ids.refreshButton.classList.contains('is-refreshing'), true);
  page.timeouts[0]();
  assert.equal(page.reloads(), 1);
});

test('legacy stage inspection preferences do not break the overview-only pipeline', () => {
  const page = boot({ saved: { runKey: 'run-1', inspectedStage: 'verify', pipelineFocus: 'implementation' } });
  assert.equal(page.context.selectStage, undefined);
  assert.equal(page.preferences().inspectedStage, undefined);
  assert.equal(page.warnings.length, 0);
});

test('stale filtering remains selected and filters requirements after reload', () => {
  const page = boot();
  page.req.getAttribute = (name) => name === 'data-status' ? 'stale' : null;
  page.context.filterReqs('stale', page.filters.find((entry) => entry.dataset.filter === 'stale'));
  assert.equal(page.req.style.display, 'block');
  page.context.savePreferences();
  const restored = boot({ saved: page.preferences() });
  assert.equal(restored.filters.find((entry) => entry.dataset.filter === 'stale').classList.contains('active'), true);
  assert.equal(restored.req.style.display, 'none');
});

test('copying a command writes exact text to clipboard and explicitly does not execute it', async () => {
  const copied = [];
  const page = boot({ clipboard: async (text) => copied.push(text) });
  await page.context.copyPrimaryCommand();
  assert.deepEqual(copied, ['node crew.js verify']);
  assert.match(page.ids['copy-feedback'].textContent, /nothing was executed/);
  assert.equal(page.ids['manual-copy'].hidden, true);
  assert.equal(page.ids['copy-command'].disabled, false);
});

test('clipboard denial provides a visible selectable fallback and explicit warning', async () => {
  const page = boot({ clipboard: async () => { throw new Error('Permission denied'); } });
  let selected = false;
  page.ids['manual-command'].select = () => { selected = true; };
  await page.context.copyPrimaryCommand();
  assert.equal(page.ids['manual-copy'].hidden, false);
  assert.equal(selected, true);
  assert.equal(page.warnings.length, 1);
  assert.match(page.ids['copy-feedback'].textContent, /Clipboard unavailable/);
  assert.equal(page.ids['copy-command'].disabled, false);
});

test('auto-refresh waits for a pending clipboard permission response', async () => {
  let resolveCopy;
  const page = boot({ clipboard: () => new Promise((resolve) => { resolveCopy = resolve; }) });
  const copying = page.context.copyPrimaryCommand();
  const tick = [...page.intervals.values()][0];
  tick();
  assert.equal(page.timeouts.length, 0);
  resolveCopy();
  await copying;
  tick();
  assert.equal(page.timeouts.length, 1);
});

test('dashboard publishes atomically and preserves the old page if publishing fails', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-dashboard-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = writeDashboard(root, { status: 'not_started' });
  const before = fs.readFileSync(file, 'utf8');
  const rename = fs.renameSync;
  let publishing = 0;
  const mock = t.mock.method(fs, 'renameSync', (temporary, target) => {
    publishing++;
    assert.equal(target, file);
    assert.notEqual(temporary, file);
    assert.equal(fs.readFileSync(target, 'utf8'), before);
    assert.match(fs.readFileSync(temporary, 'utf8'), /^<!DOCTYPE html>/);
    throw new Error('Publishing denied');
  });
  assert.throws(() => writeDashboard(root, { status: 'done' }), /Publishing denied/);
  assert.equal(publishing, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['dashboard.html']);
  mock.mock.restore();
  assert.equal(fs.renameSync, rename);
  writeDashboard(root, { status: 'done' });
  assert.match(fs.readFileSync(file, 'utf8'), /Complete — no work in progress/);
});
