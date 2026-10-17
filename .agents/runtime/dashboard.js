'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { derivePipeline, scanSignals, CRITERIA } = require('./pipeline');
const styles = require('./dashboard/styles');
const { clientScript } = require('./dashboard/client');
const { escapeHtml, formatTime: fmtTime, tailLog } = require('./dashboard/format');

function generateDashboardHtml(report, rootDir) {
  const isStarted = !!report && !!report.requirements;
  const status = report?.status || 'not_started';
  const backend = report?.backend || 'none';
  const reqs = report?.requirementStatus || [];
  const totalReqs = reqs.length;
  const passedReqs = reqs.filter((r) => r.status === 'passed').length;
  const pendingReqs = reqs.filter((r) => r.status === 'pending').length;
  const blockedReqs = reqs.filter((r) => r.status === 'blocked').length;
  const staleReqs = reqs.filter((r) => r.status === 'stale').length;
  const reqPct = totalReqs > 0 ? Math.round((passedReqs / totalReqs) * 100) : 0;
  
  // Pipeline derived from run state + live filesystem signals (see pipeline.js)
  const approvedAtMs = report?.approved?.at ? new Date(report.approved.at).getTime() : 0;
  const specAtMs = report?.spec?.at ? new Date(report.spec.at).getTime() : 0;
  const sinceMs = Math.max(approvedAtMs, specAtMs) - 1000;
  const signals = scanSignals(rootDir, report?.spec ? sinceMs : 0);
  const pipeline = derivePipeline(report, signals);
  const { stages, overallPct } = pipeline;

  const checks = report?.verification?.checks || [];
  const checksPassedCount = checks.filter((c) => c.passed).length;
  const hasChecks = checks.length > 0;
  const checksPassed = pipeline.verificationFresh;
  const acceptances = report?.acceptance || {};
  const criteria = CRITERIA;
  const acceptedCount = pipeline.acceptedCount;
  // fmtTime and tailLog imported from ./dashboard/format

  const gateLog = (name) => {
    const c = checks.find((x) => x.name === name);
    if (!c || c.passed) return '';
    const tail = tailLog(rootDir, c.log);
    return tail ? `<pre class="gate-log">${escapeHtml(tail)}</pre>` : '';
  };

  const criteriaDescriptions = {
    requirements: 'Spec & acceptance criteria mapping',
    design: 'Visual tokens, theme & UX states',
    backend: 'Database schema, rules & auth proof',
    security: 'Zero-trust storage & permission audit',
    experience: 'Real journey, a11y & responsive check'
  };

  const allWarnings = [
    ...(report?.preflight || []),
    ...(report?.specIssues || [])
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlutterCrew Live Workflow</title>
  <style>${styles}</style>

</head>
<body>
  <div class="container">
    <!-- Header -->
    <header>
      <div class="brand">
        <span class="logo-badge">FC</span>
        <div>
          <h1 class="brand-title">FlutterCrew Live Workflow</h1>
          <div class="brand-subtitle">Spec-Driven &bull; Integration-Verified Delivery Pipeline</div>
        </div>
      </div>
      <div class="header-actions">
        <span class="chip">backend: ${escapeHtml(backend)}</span>
        <span class="chip chip-status-${escapeHtml(status)}">status: ${escapeHtml(status)}</span>
        <label class="auto-refresh-toggle">
          <input type="checkbox" id="autoRefreshToggle" checked onchange="toggleAutoRefresh(this.checked)">
          <span>Auto-refresh</span>
        </label>
        <button class="btn" onclick="location.reload()">
          <span>&#x21bb;</span> Refresh
        </button>
      </div>
    </header>

    <!-- Metrics Overview (4 Quantifiable Metrics in Natural Sequence) -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">
          <span>Delivery Progress</span>
          <span>${overallPct}%</span>
        </div>
        <div class="metric-val">${overallPct}%</div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${overallPct}%;"></div>
        </div>
        <div class="metric-sub">${passedReqs} of ${totalReqs} REQs &bull; ${acceptedCount}/5 gates</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Requirements Trace</div>
        <div class="metric-val">${passedReqs} / ${totalReqs}</div>
        <div class="metric-sub">${pendingReqs} pending &bull; ${blockedReqs} blocked</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Automated Checks</div>
        <div class="metric-val" style="color: ${checksPassed ? 'var(--success)' : (hasChecks ? 'var(--danger)' : 'var(--text-main)')};">
          ${checksPassed ? '3 / 3 PASS' : (hasChecks ? `${checksPassedCount} / 3 Checks` : 'QUEUED')}
        </div>
        <div class="metric-sub">dart format &bull; analyze &bull; test</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Review Attestations</div>
        <div class="metric-val">${acceptedCount} / 5</div>
        <div class="metric-sub">${acceptedCount === 5 ? 'All criteria attested' : `${5 - acceptedCount} pending review`}</div>
      </div>
    </div>

    <!-- Pipeline Stepper (7 Stages) -->
    <div class="section-label">
      <span>Pipeline Lifecycle</span>
    </div>
    <div class="pipeline-grid">
      ${stages.map((st) => `
        <div class="stage-card ${st.status}">
          <div class="stage-top">
            <span class="stage-idx">0${st.number}</span>
            <span class="stage-tag tag-${st.status}">${st.status === 'completed' ? '&#10003; DONE' : st.status}</span>
          </div>
          <div class="stage-title">${escapeHtml(st.title)}${st.human ? ' &#128100;' : ''}</div>
          <div class="stage-agent">${escapeHtml(st.agent)}</div>
          <div class="stage-desc">${escapeHtml(st.desc)}</div>
          <ul class="stage-steps">
            ${(st.steps || []).map((s) => `
              <li class="step step-${s.state}" title="${escapeHtml(s.detail || '')}">
                <span class="step-mark">${s.state === 'done' ? '&#10003;' : (s.state === 'fail' ? '&#10007;' : (s.state === 'active' ? '&#9679;' : '&#9675;'))}</span>
                <span class="step-text">${escapeHtml(s.label)}${s.detail ? `<em>${escapeHtml(s.detail)}</em>` : ''}</span>
              </li>`).join('')}
          </ul>
          ${st.at ? `<div class="stage-time">${escapeHtml(fmtTime(st.at))}</div>` : ''}
        </div>
      `).join('')}
    </div>

    <!-- Main Content Layout Grid -->
    <div class="layout-grid">
      <!-- Left Column: Requirements Traceability Matrix -->
      <div class="box">
        <div class="box-header">
          <div class="box-title">
            <span>Requirements Traceability Matrix (SDD)</span>
            <span style="font-family: var(--mono-font); font-size: 11px; color: var(--text-muted); font-weight: normal;">
              (${passedReqs}/${totalReqs} passed)
            </span>
          </div>
          <div class="box-actions">
            <button class="btn btn-sm" onclick="toggleAllReqs(true)">
              <span>&#x25BC;</span> Unfold All
            </button>
            <button class="btn btn-sm" onclick="toggleAllReqs(false)">
              <span>&#x25B6;</span> Fold All
            </button>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="filter-bar">
          <div class="filter-btn-group">
            <button class="filter-chip active" onclick="filterReqs('all', this)">All (${totalReqs})</button>
            <button class="filter-chip" onclick="filterReqs('passed', this)">Passed (${passedReqs})</button>
            <button class="filter-chip" onclick="filterReqs('pending', this)">Pending (${pendingReqs})</button>
            <button class="filter-chip" onclick="filterReqs('blocked', this)">Blocked (${blockedReqs})</button>
          </div>
          <input type="text" class="search-input" placeholder="Search ID or description..." oninput="searchReqs(this.value)">
        </div>

        ${reqs.length === 0 ? `
          <div style="padding: 36px 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
            No requirements baselined yet.<br>
            Awaiting <code>spec.json</code> extraction via <code>planner</code>.
          </div>
        ` : `
          <div class="req-list" id="requirementsList">
            ${reqs.map((r) => `
              <details class="req-card" data-status="${escapeHtml(r.status)}" data-id="${escapeHtml(r.id)}" ${r.status !== 'passed' || reqs.length <= 2 ? 'open' : ''}>
                <summary class="req-summary">
                  <div class="req-left">
                    <span class="req-icon">&#x25B6;</span>
                    <span class="req-id-badge">${escapeHtml(r.id)}</span>
                    <span class="req-desc-short">${escapeHtml(r.description || 'No description provided')}</span>
                  </div>
                  <div class="req-right">
                    ${(() => {
                      const refs = r.references || [];
                      const count = (kind) => refs.filter((x) => x.kind === kind).length;
                      const dot = (label, n) => `<span class="art-dot ${n > 0 ? 'art-on' : ''}" title="${label}: ${n}">${label[0].toUpperCase()}${n > 0 ? n : ''}</span>`;
                      return `<span class="art-dots">${dot('implementation', count('implementation'))}${dot('tests', count('tests'))}${dot('evidence', count('evidence'))}</span>`;
                    })()}
                    <span class="chip" style="font-size:10px; padding:2px 6px;">${escapeHtml(r.verification || 'auto')}</span>
                    <span class="req-pill req-${r.status}">${escapeHtml(r.status)}</span>
                  </div>
                </summary>
                <div class="req-body">
                  <div class="req-detail-section">
                    <div class="req-detail-title">Description</div>
                    <div class="req-text-block">${escapeHtml(r.description || 'No description')}</div>
                  </div>

                  ${r.source ? `
                    <div class="req-detail-section">
                      <div class="req-detail-title">Source Reference</div>
                      <div style="font-family: var(--mono-font); font-size: 11px; color: var(--accent);">
                        ${escapeHtml(r.source)}
                      </div>
                    </div>
                  ` : ''}

                  ${(r.acceptanceCriteria && r.acceptanceCriteria.length > 0) ? `
                    <div class="req-detail-section">
                      <div class="req-detail-title">Acceptance Criteria (${r.acceptanceCriteria.length})</div>
                      <ul class="criteria-list">
                        ${r.acceptanceCriteria.map((ac) => `
                          <li class="criteria-item">
                            <span class="criteria-mark">&#x2713;</span>
                            <span>${escapeHtml(ac)}</span>
                          </li>
                        `).join('')}
                      </ul>
                    </div>
                  ` : ''}

                  ${(r.references && r.references.length > 0) ? `
                    <div class="req-detail-section">
                      <div class="req-detail-title">Traced Artifacts (${r.references.length})</div>
                      <div class="ref-chips-grid">
                        ${r.references.map((ref) => `
                          <div class="ref-chip" title="${escapeHtml(ref.evidence)}">
                            <span class="ref-kind-tag ref-kind-${escapeHtml(ref.kind || 'impl')}">${escapeHtml(ref.kind || 'file')}</span>
                            <span>${escapeHtml(ref.evidence)}</span>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}

                  ${report?.traceability?.[r.id]?.at ? `
                    <div class="req-detail-section">
                      <div class="req-detail-title">Last Trace</div>
                      <div style="font-family: var(--mono-font); font-size: 11px; color: var(--text-muted);">
                        ${escapeHtml(report.traceability[r.id].status || '')} at ${escapeHtml(fmtTime(report.traceability[r.id].at))}
                      </div>
                    </div>
                  ` : (r.status === 'pending' ? `
                    <div class="req-detail-section">
                      <div class="req-detail-title">Next Step</div>
                      <div style="font-size: 12px; color: var(--text-muted);">Implement, write tests, then run <code>crew.js trace ${escapeHtml(r.id)} &lt;trace.json&gt;</code></div>
                    </div>
                  ` : '')}

                  ${(r.notes || r.evidence || r.testRationale) ? `
                    <div class="req-detail-section">
                      <div class="req-detail-title">Verification Notes</div>
                      <div class="req-text-block" style="font-size: 12px; color: var(--text-muted);">
                        ${r.notes ? `<div><strong>Notes:</strong> ${escapeHtml(r.notes)}</div>` : ''}
                        ${r.evidence ? `<div><strong>Report:</strong> <code>${escapeHtml(r.evidence)}</code></div>` : ''}
                        ${r.testRationale ? `<div><strong>Manual Rationale:</strong> <i>${escapeHtml(r.testRationale)}</i></div>` : ''}
                      </div>
                    </div>
                  ` : ''}
                </div>
              </details>
            `).join('')}
            <div class="req-empty-msg" id="reqEmptyMsg">No requirements match the current filter or search query.</div>
          </div>
        `}
      </div>

      <!-- Right Column: Verification & Acceptance Gates -->
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Verification Gates -->
        <div class="box">
          <div class="box-header">
            <div class="box-title">Automated Verification Gates</div>
            <span class="chip" style="font-size:10px;">${checksPassedCount}/3 Passed</span>
          </div>
          <div>
            <div class="gate-item">
              <div class="gate-title-col">
                <span class="gate-title">
                  <code>dart format</code>
                </span>
                <span class="gate-sub">Code Formatting Style</span>
              </div>
              <span class="${checks.find((c) => c.name === 'format')?.passed ? 'gate-pass' : (hasChecks ? 'gate-fail' : 'gate-wait')}">
                ${checks.find((c) => c.name === 'format')?.passed ? '&#10003; PASSED' : (hasChecks ? '&#10007; FAILED' : '&#9675; PENDING')}
              </span>
            </div>
            ${gateLog('format')}
            <div class="gate-item">
              <div class="gate-title-col">
                <span class="gate-title">
                  <code>flutter analyze</code>
                </span>
                <span class="gate-sub">Linter & Type Checking</span>
              </div>
              <span class="${checks.find((c) => c.name === 'analyze')?.passed ? 'gate-pass' : (hasChecks ? 'gate-fail' : 'gate-wait')}">
                ${checks.find((c) => c.name === 'analyze')?.passed ? '&#10003; PASSED' : (hasChecks ? '&#10007; FAILED' : '&#9675; PENDING')}
              </span>
            </div>
            ${gateLog('analyze')}
            <div class="gate-item">
              <div class="gate-title-col">
                <span class="gate-title">
                  <code>flutter test</code>
                </span>
                <span class="gate-sub">Unit & Widget Test Suites</span>
              </div>
              <span class="${checks.find((c) => c.name === 'tests')?.passed ? 'gate-pass' : (hasChecks ? 'gate-fail' : 'gate-wait')}">
                ${checks.find((c) => c.name === 'tests')?.passed ? '&#10003; PASSED' : (hasChecks ? '&#10007; FAILED' : '&#9675; PENDING')}
              </span>
            </div>
            ${gateLog('tests')}
            ${hasChecks ? `<div class="gate-meta">Verified at ${escapeHtml(fmtTime(report.verification.at))}${pipeline.verificationStale ? ' &bull; <span style="color: var(--warning);">STALE: source changed since, re-run verify</span>' : ''}</div>` : '<div class="gate-meta">Not run yet &bull; <code>crew.js verify</code></div>'}
          </div>
        </div>

        <!-- Review Acceptance Attestations -->
        <div class="box">
          <div class="box-header">
            <div class="box-title">Acceptance Review Attestations</div>
            <span class="chip" style="font-size:10px;">${acceptedCount}/5 Attested</span>
          </div>
          <div>
            ${criteria.map((c) => {
              const entry = acceptances[c];
              const isStale = report?.missingOrStaleCriteria?.includes(c);
              const isOk = !!entry && !isStale;
              return `
                <div class="gate-item">
                  <div class="gate-title-col">
                    <span class="gate-title" style="text-transform: capitalize;">
                      ${c}
                    </span>
                    <span class="gate-sub">${escapeHtml(criteriaDescriptions[c] || '')}</span>
                    ${entry ? `<span class="gate-sub" style="color: var(--text-dim);"><code>${escapeHtml(entry.evidence || '')}</code> &bull; ${escapeHtml(fmtTime(entry.at))}${isStale ? ' &bull; evidence stale (source changed)' : ''}</span>` : ''}
                  </div>
                  <span class="${isOk ? 'gate-pass' : (isStale ? 'gate-fail' : 'gate-wait')}">
                    ${isOk ? '&#10003; ATTESTED' : (isStale ? '&#9888; STALE' : '&#9675; MISSING')}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Warnings / Preflight Issues -->
        ${allWarnings.length > 0 ? `
          <div class="box" style="border-color: #5c2b29;">
            <div class="box-header" style="background: #231514;">
              <div class="box-title" style="color: #ff8b73;">Preflight & Spec Warnings (${allWarnings.length})</div>
            </div>
            <div>
              ${allWarnings.map((iss) => `
                <div class="warning-item">
                  <span>&#9888;</span>
                  <span>${escapeHtml(iss)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Minimalist Footer -->
    <footer>
      <div>FlutterCrew Agent Runtime &bull; Spec-Driven Delivery</div>
      <div id="lastUpdatedText">Loaded just now</div>
    </footer>
  </div>

  <script>${clientScript({ status })}</script>

</body>
</html>`;
}

function writeDashboard(root, report) {
  const targetDir = path.join(root, '.fluttercrew');
  fs.mkdirSync(targetDir, { recursive: true });
  const htmlPath = path.join(targetDir, 'dashboard.html');
  const html = generateDashboardHtml(report, root);
  fs.writeFileSync(htmlPath, html, 'utf8');
  return htmlPath;
}

module.exports = { generateDashboardHtml, writeDashboard };
