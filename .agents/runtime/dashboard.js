'use strict';

const path = require('node:path');
const { writeFileAtomic } = require('./fsutil');
const { derivePipeline, scanSignals } = require('./pipeline');
const { GATES, CRITERIA, CRITERIA_DESCRIPTIONS } = require('./constants');
const styles = require('./dashboard/styles');
const { clientScript } = require('./dashboard/client');
const { presentation, tone, actionTone } = require('./dashboard/presentation');
const { escapeHtml: esc, formatTime: fmtTime, tailLog } = require('./dashboard/format');

const symbol = (state) => ({ success: '&#10003;', info: '&#8594;', warning: '&#8635;', danger: '!', neutral: '&#8212;' }[state]);
const stamp = (at) => at ? `<time datetime="${esc(at)}">${esc(fmtTime(at))}</time>` : '';
const badge = (label, state) => `<span class="status-label tone-${state}">${esc(label)}</span>`;

function generateDashboardHtml(report = {}, rootDir) {
  const status = report.status || 'not_started';
  const since = Math.max(Date.parse(report.approved?.at || '') || 0, Date.parse(report.spec?.at || '') || 0) - 1000;
  const pipeline = derivePipeline(report, scanSignals(rootDir, report.spec ? since : 0));
  const view = presentation(report, pipeline);
  const currentStage = view.stages.find((stage) => stage.id === pipeline.current.id);
  const reqs = view.requirements;
  const passed = reqs.filter((entry) => entry.status === 'passed').length;
  const focusRequirement = reqs.find((entry) => entry.status !== 'passed' || entry.tasks.some((task) => task.state !== 'done'))?.id;
  const title = reqs.length === 1 ? reqs[0].description
    : (report.requirements ? `${reqs.length} requirements · ${path.basename(report.requirements)}` : 'Start a delivery run');
  const checks = report.verification?.checks || [];
  const checkStates = report.verificationStatus?.checks || [];
  const checksPassed = checkStates.filter((entry) => entry.status === 'passed').length;
  const reviews = CRITERIA.map((id) => {
    const entry = report.acceptance?.[id];
    const state = !entry ? 'pending' : (report.missingOrStaleCriteria?.includes(id) ? 'stale' : 'passed');
    return { id, entry, state };
  });
  const accepted = reviews.filter((entry) => entry.state === 'passed').length;
  const warnings = [...(report.preflight || []), ...(report.specIssues || []), ...(report.approvalStatus?.issues || [])];
  const remaining = Math.max(0, (report.nextActions?.length || 0) - 1);
  const gateBadge = (state) => `<span class="${{
    passed: 'gate-pass', stale: 'gate-stale', failed: 'gate-fail'
  }[state] || 'gate-wait'}">${esc(state.toUpperCase())}</span>`;
  const actionRow = (action) => `<div class="action-row tone-${actionTone(action, report)}">
    <strong>${esc(action.issue)}</strong><p>${esc(action.cause)}</p>
    ${action.commands.map((command) => `<code class="action-command">${esc(command)}</code>`).join('')}
  </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlutterCrew Live Workflow</title>
  <style>${styles}</style>
</head>
<body data-run-key="${esc(`${report.startedAt || ''}:${report.requirements || ''}`)}" data-run-status="${esc(status)}" data-current-stage="${pipeline.current.id}">
<div class="container">
  <header class="page-header">
    <div class="brand">
      <span class="logo-badge" aria-hidden="true">FC</span>
      <div><p class="eyebrow">Delivery overview</p><h1 class="brand-title">${esc(title)}</h1></div>
    </div>
    <div class="header-actions">
      <span class="chip">backend: ${esc(report.backend || 'none')}</span>
      ${badge(status, tone(status))}
      ${checks.some((entry) => entry.simulated) ? '<span class="chip">SIMULATED DEMO</span>' : ''}
      <label class="auto-refresh-toggle"><input type="checkbox" id="autoRefreshToggle" checked onchange="toggleAutoRefresh(this.checked)"> Auto-refresh</label>
      <button class="btn" id="refreshButton" onclick="refreshDashboardPage()"><span class="refresh-icon" aria-hidden="true">&#8635;</span> Refresh</button>
    </div>
  </header>

  <section class="box hero tone-${view.hero.tone}" id="next-action-panel" aria-labelledby="next-action-title"
    data-motion-key="primary-action" data-motion-value="${esc(`${status}:${view.hero.title}`)}">
    <div class="hero-main">
      <span class="status-symbol" aria-hidden="true">${symbol(view.hero.tone)}</span>
      <div class="hero-copy">
        <p class="eyebrow">Next Action <span class="runtime-state">· Runtime status: ${esc(status)}</span></p>
        <h2 id="next-action-title">${esc(view.hero.title)}</h2>
        <a class="stage-summary" href="#pipeline-panel" data-motion-key="stage-summary" data-motion-value="${esc(`${currentStage.id}:${currentStage.label}`)}">Stage ${currentStage.number}/7 · ${esc(currentStage.title)} · ${esc(currentStage.label)}</a>
        <p>${esc(view.hero.cause)}</p>
        <p class="retained-summary">${view.reusable.length ? `Still valid: ${esc(view.reusable.join(' · '))}.` : 'No reusable evidence recorded yet.'}</p>
      </div>
    </div>
    <div class="hero-actions">
      <span class="next-owner">Next role: <strong>${esc(view.hero.owner)}</strong></span>
      ${view.hero.command ? `<button class="btn btn-primary" id="copy-command" data-command="${esc(view.hero.command)}" onclick="copyPrimaryCommand()">${esc(view.hero.copyLabel)}</button>`
        : `<a class="btn" href="#${status === 'done' ? 'verification-panel' : 'pipeline-panel'}">${status === 'done' ? 'View evidence' : 'View delivery steps'}</a>`}
      ${remaining ? `<button class="btn" onclick="openAffectedWork()">View ${remaining} ${report.sourceChangedSinceVerification ? 'affected' : 'other'} item${remaining === 1 ? '' : 's'}</button>` : ''}
    </div>
    <p id="copy-feedback" class="copy-feedback" role="status" aria-live="polite"></p>
    ${view.hero.command ? `<label class="manual-copy" id="manual-copy" hidden>Copy this command manually:
      <textarea id="manual-command" readonly rows="2">${esc(view.hero.command)}</textarea></label>` : ''}
    ${remaining ? `<details class="affected-work" id="affected-work">
      <summary>${report.sourceChangedSinceVerification ? 'Affected work' : 'Other required work'} (${remaining})</summary>
      <p class="detail-note">All remaining items are listed here. Grouping does not waive any completion gate.</p>
      <div class="action-groups">${view.groups.map((group) => `<section class="action-group">
        <h3>${esc(group.label)} <span class="count">${group.actions.length}</span></h3>
        ${group.actions.map(actionRow).join('')}</section>`).join('')}</div>
    </details>` : ''}
  </section>

  <main class="layout-grid">
    <section class="box" id="requirements-panel" aria-labelledby="requirements-title">
      <div class="box-header"><div><h2 id="requirements-title">Requirements &amp; work</h2>
        <p class="section-meta" data-motion-key="requirements-count" data-motion-value="${passed}/${reqs.length}">${passed}/${reqs.length} requirements have current passing evidence</p>
      </div><div class="box-actions"><button class="btn btn-sm" onclick="toggleAllReqs(true)">Unfold All</button><button class="btn btn-sm" onclick="toggleAllReqs(false)">Fold All</button></div></div>
      <div class="filter-bar"><div class="filter-btn-group">${['all', 'passed', 'pending', 'stale', 'blocked'].map((filter) =>
        `<button class="filter-chip ${filter === 'all' ? 'active' : ''}" id="filter-${filter}" data-filter="${filter}" onclick="filterReqs('${filter}', this)">
          ${filter[0].toUpperCase() + filter.slice(1)} (${filter === 'all' ? reqs.length : reqs.filter((r) => r.status === filter).length})</button>`).join('')}</div>
        <input class="search-input" id="requirement-search" aria-label="Search requirements" placeholder="Search requirements or work..." oninput="searchReqs(this.value)">
      </div>
      <div class="req-list" id="requirementsList">
        ${reqs.length ? reqs.map((r) => `<details class="req-card" data-status="${esc(r.status)}" data-id="${esc(r.id)}"
          data-motion-key="requirement:${esc(r.id)}" data-motion-value="${esc(r.status)}" ${r.id === focusRequirement ? 'open' : ''}>
          <summary class="req-summary">
            <span class="req-icon" aria-hidden="true">&#9656;</span>
            <span class="req-overview"><span class="req-heading"><span class="req-id-badge">${esc(r.id)}</span><strong>${esc(r.description)}</strong></span>
              <span class="work-summary">${r.tasks.some((task) => task.completedBefore) ? 'Completion records retained' : 'Work declarations and evidence tracked separately'}</span></span>
            ${badge(({ passed: 'Evidence current', stale: 'Evidence stale', blocked: 'Blocked', pending: 'Awaiting evidence' })[r.status] || r.status, tone(r.status))}
          </summary>
          <div class="req-body">
            <div class="task-grid">${r.tasks.map((task) => `<article class="task-record tone-${tone(task.state)}" data-state="${esc(task.state)}"
              data-motion-key="task:${esc(r.id)}:${task.phase}" data-motion-value="${esc(task.state)}">
              <div class="task-heading"><h3>${task.phase === 'implementation' ? 'Implementation' : 'Testing'}</h3>${badge(task.validity, tone(task.state))}</div>
              <p class="work-record">${esc(task.history)} ${stamp(task.at)}</p>
              <p class="task-validity">Current validity: <strong>${esc(task.validity)}</strong></p>
              ${task.notes ? `<p class="detail-note">${esc(task.notes)}</p>` : ''}
            </article>`).join('')}</div>
            ${r.notes ? `<p class="requirement-note">${esc(r.notes)}</p>` : ''}
            ${r.actions.length ? `<details class="requirement-actions" id="actions-${esc(r.id)}"><summary>Next steps for ${esc(r.id)} (${r.actions.length})</summary>${r.actions.map(actionRow).join('')}</details>` : ''}
            <details class="requirement-evidence" id="evidence-${esc(r.id)}"><summary>Acceptance criteria, files &amp; evidence</summary>
              ${r.source ? `<p class="detail-note">Source: ${esc(r.source)}</p>` : ''}
              <h3>Acceptance Criteria (${r.acceptanceCriteria?.length || 0})</h3>
              <ul class="criteria-list">${(r.acceptanceCriteria || []).map((criterion) => `<li>${esc(criterion)}</li>`).join('')}</ul>
              <p class="detail-note">Verification mode: ${esc(r.verification || 'automated')}</p>
              <div class="art-dots">${['implementation', 'tests', 'evidence'].map((kind) => {
                const count = (r.references || []).filter((ref) => ref.kind === kind).length;
                return `<span class="art-dot ${count ? 'art-on' : ''}">${kind}: ${count}</span>`;
              }).join('')}</div>
              <ul class="reference-list">${(r.references || []).map((ref) => `<li><span>${esc(ref.kind)}</span> <code>${esc(ref.evidence)}</code></li>`).join('')}</ul>
              ${r.evidence ? `<p class="detail-note">Trace report: <code>${esc(r.evidence)}</code></p>` : ''}
              ${r.testRationale ? `<p class="detail-note">Manual verification rationale: ${esc(r.testRationale)}</p>` : ''}
              ${report.traceability?.[r.id]?.at ? `<p class="detail-note">Last trace recorded: ${esc(report.traceability[r.id].status)} ${stamp(report.traceability[r.id].at)}. Current evidence: ${esc(r.status)}.</p>` : ''}
            </details>
          </div>
        </details>`).join('') : '<p class="empty-state">No requirements baselined yet. Capture the request and review the spec first.</p>'}
        <p class="req-empty-msg" id="reqEmptyMsg">No requirements match this filter or search.</p>
      </div>
    </section>

    <aside class="evidence-column">
      <section class="pipeline-panel" id="pipeline-panel" aria-labelledby="pipeline-title">
        <div class="section-heading"><h2 id="pipeline-title">Pipeline Lifecycle</h2>
          <span class="section-meta" data-motion-key="stage-count" data-motion-value="${pipeline.completedStages}">${pipeline.completedStages} / 7 stages complete · not an effort estimate</span>
        </div>
        <p class="pipeline-note"><span aria-hidden="true">&gt;_</span> Select any stage to inspect it. CURRENT marks workflow focus, not live execution.</p>
        <ol class="pipeline-grid" aria-label="Delivery steps">${view.stages.map((stage) => `
          <li><button class="stage-card ${stage.status} tone-${stage.tone}" id="step-${stage.id}" data-stage="${stage.id}"
            data-motion-key="stage:${stage.id}" data-motion-value="${stage.state}:${stage.label}:${stage.id === pipeline.current.id && status !== 'done'}"
            data-focus="${stage.id === pipeline.current.id && status !== 'done'}" aria-current="${stage.id === pipeline.current.id ? 'step' : 'false'}"
            aria-expanded="${stage.id === pipeline.current.id}" aria-controls="stage-panel-${stage.id}"
            onclick="selectStage(this.dataset.stage)">
            <span class="stage-number" aria-hidden="true">${stage.state === 'completed' ? '&#10003;' : stage.number}</span>
            ${stage.id === pipeline.current.id && status !== 'done' ? '<span class="stage-focus">CURRENT</span>' : ''}
            <span class="stage-title">${esc(stage.title)}</span><span class="stage-state">${esc(stage.label)}</span>
            ${stage.number < 7 ? '<span class="stage-link" aria-hidden="true"></span>' : ''}
          </button></li>`).join('')}</ol>
        ${view.stages.map((stage) => `<div class="stage-detail" id="stage-panel-${stage.id}" ${stage.id === pipeline.current.id ? '' : 'hidden'}>
          <div class="stage-context"><strong>${esc(stage.title)}</strong><span>Role: ${esc(stage.agent)}</span>
            ${badge(stage.label, stage.tone)}
          </div>
          <p>${stage.state === 'stale' ? 'Previous work records are retained. Current evidence needs review; this does not mean the work was never done.'
            : (stage.state === 'active' ? 'This step needs attention. It is not a live process indicator.' : esc(stage.desc))}</p>
          <details class="step-checklist" id="checklist-${stage.id}"><summary>Step checklist and recorded activity</summary>
            <ul class="stage-steps">${stage.steps.map((step) => `<li class="step step-${step.state}">
              <span aria-hidden="true">${step.state === 'done' ? '&#10003;' : (step.state === 'fail' ? '!' : '&#8212;')}</span>
              <span>${esc(step.label)}${step.detail ? `<small>${esc(step.detail)}</small>` : ''}</span></li>`).join('')}</ul>
            ${stage.at ? `<p class="detail-note">Recorded / activity time: ${esc(fmtTime(stage.at))}. File activity is a hint, not proof of execution.</p>` : ''}
          </details>
        </div>`).join('')}
      </section>
      <section class="box" id="verification-panel" aria-labelledby="verification-title">
        <div class="box-header"><h2 id="verification-title">Verification &amp; evidence</h2></div>
        <details class="evidence-group" id="checks-details">
          <summary><span><strong>Automated Checks</strong><small data-motion-key="checks-count" data-motion-value="${checksPassed}:${report.verificationStatus?.status}">${checksPassed}/3 Passed · current log integrity</small></span>
            ${badge(report.verificationStatus?.valid ? 'Current' : ({ stale: 'Recheck needed', failed: 'Failed' }[report.verificationStatus?.status] || 'Not run'), tone(report.verificationStatus?.status))}
          </summary>
          ${GATES.map((gate) => {
            const entry = checks.find((check) => check.name === gate.name);
            const state = checkStates.find((check) => check.name === gate.name)?.status || 'pending';
            const log = entry && !entry.passed ? tailLog(rootDir, entry.log) : '';
            return `<div class="gate-item"><code>${esc(gate.label)}</code>${gateBadge(state)}</div>
              ${log ? `<pre class="gate-log">${esc(log)}</pre>` : ''}`;
          }).join('')}
          <p class="gate-meta">${report.verification ? `${report.verification.passed ? 'PASS' : 'Failure'} recorded ${esc(fmtTime(report.verification.at))}. Current validity: ${esc(report.verificationStatus?.status || 'unknown')}.` : 'No verification run recorded.'}</p>
          ${(report.verificationStatus?.issues || []).map((issue) => `<p class="detail-note">${esc(issue)}</p>`).join('')}
        </details>
        <details class="evidence-group" id="reviews-details">
          <summary><span><strong>Review Attestations</strong><small data-motion-key="reviews-count" data-motion-value="${accepted}">${accepted}/5 current · ${5 - accepted} need attention</small></span>
            ${badge(accepted === 5 ? 'Current' : (reviews.some((r) => r.state === 'stale') ? 'Review needed' : 'Pending'), accepted === 5 ? 'success' : (reviews.some((r) => r.state === 'stale') ? 'warning' : 'neutral'))}
          </summary>
          ${reviews.map(({ id, state, entry }) => `<div class="review-item">
            <div class="gate-item"><strong>${id}</strong>${badge({ passed: 'ATTESTED', stale: 'STALE', pending: 'MISSING' }[state], tone(state))}</div>
            <p class="detail-note">${esc(CRITERIA_DESCRIPTIONS[id])}</p>
            ${entry ? `<p class="detail-note">Attestation recorded ${stamp(entry.at)}<br><code>${esc(entry.evidence)}</code></p>` : ''}
          </div>`).join('')}
        </details>
        <p class="integrity-note">Recorded work is not proof of current validity. Stale evidence cannot support completion.</p>
      </section>
    </aside>
  </main>

  <details class="box activity-panel" id="recent-activity"><summary>Recent recorded activity <span class="section-meta">Latest ${view.events.length} records</span></summary>
    ${view.events.length ? `<ol class="activity-list">${view.events.map((event) => `<li>${stamp(event.at)}<span>${esc(event.text)}</span></li>`).join('')}</ol>` : '<p class="empty-state">No activity recorded yet.</p>'}
    <p class="detail-note">These are recorded declarations and results, not a live agent/process monitor.</p>
  </details>
  <details class="box context-panel" id="run-context"><summary>Run context &amp; technical details ${warnings.length ? `(${warnings.length} issues)` : ''}</summary>
    <dl><dt>Brief</dt><dd>${esc(report.requirements || 'Not captured')}</dd>
      <dt>Backend</dt><dd>${esc(report.backend || 'none')}</dd>
      <dt>Spec</dt><dd>${report.spec ? `Revision ${esc(report.spec.revision)}` : 'Not baselined'}</dd>
      <dt>Approval</dt><dd>${esc(report.approvalStatus?.status || 'missing')}</dd>
      <dt>Started</dt><dd>${report.startedAt ? esc(fmtTime(report.startedAt)) : 'Not started'}</dd></dl>
    ${warnings.map((warning) => `<p class="warning-item">${esc(warning)}</p>`).join('')}
  </details>
  <footer><span>FlutterCrew Live Workflow</span><span id="lastUpdatedText">Loaded just now</span></footer>
</div>
<script>${clientScript()}</script>
</body>
</html>`;
}

function writeDashboard(root, report) {
  const targetDir = path.join(root, '.fluttercrew');
  const htmlPath = path.join(targetDir, 'dashboard.html');
  writeFileAtomic(htmlPath, generateDashboardHtml(report, root));
  return htmlPath;
}

module.exports = { generateDashboardHtml, writeDashboard };
