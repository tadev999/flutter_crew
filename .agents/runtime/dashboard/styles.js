'use strict';

/** Dashboard stylesheet (dark, developer-first theme; no glow effects). */
module.exports = `
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --surface-subtle: #21262d;
      --surface-hover: #1c2128;
      --border: #30363d;
      --border-muted: #21262d;
      --text-main: #e6edf3;
      --text-muted: #8b949e;
      --text-dim: #6e7681;
      
      --accent: #58a6ff;
      --accent-subtle: rgba(56, 139, 253, 0.12);
      --success: #3fb950;
      --success-subtle: rgba(46, 160, 67, 0.12);
      --warning: #d29922;
      --warning-subtle: rgba(187, 128, 9, 0.12);
      --danger: #f85149;
      --danger-subtle: rgba(248, 81, 73, 0.12);
      --purple: #bc8cff;
      --purple-subtle: rgba(163, 113, 247, 0.12);
      
      --mono-font: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      --sans-font: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--sans-font);
      background-color: var(--bg);
      color: var(--text-main);
      line-height: 1.5;
      padding: 20px 24px;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 1280px;
      margin: 0 auto;
    }

    /* Header Bar */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-badge {
      font-family: var(--mono-font);
      font-weight: 700;
      font-size: 13px;
      background: var(--surface-subtle);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 5px 9px;
      border-radius: 6px;
      letter-spacing: 0.05em;
    }

    .brand-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-main);
      letter-spacing: -0.01em;
    }

    .brand-subtitle {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 1px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .chip {
      font-family: var(--mono-font);
      font-size: 11px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .chip-status-in_progress, .chip-status-active {
      color: var(--accent);
      border-color: rgba(56, 139, 253, 0.4);
      background: var(--accent-subtle);
    }
    .chip-status-done, .chip-status-completed {
      color: var(--success);
      border-color: rgba(46, 160, 67, 0.4);
      background: var(--success-subtle);
    }
    .chip-status-blocked, .chip-status-failed {
      color: var(--danger);
      border-color: rgba(248, 81, 73, 0.4);
      background: var(--danger-subtle);
    }

    .btn {
      background: var(--surface-subtle);
      color: var(--text-main);
      border: 1px solid var(--border);
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s, border-color 0.15s;
    }

    .btn:hover {
      background: #2b313a;
      border-color: #484f58;
    }

    .btn-sm {
      padding: 3px 8px;
      font-size: 11px;
    }

    .auto-refresh-toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--text-muted);
      user-select: none;
      cursor: pointer;
    }

    .auto-refresh-toggle input {
      accent-color: var(--accent);
      cursor: pointer;
    }

    /* Metric Overview Grid (4 Clean Quantifiable Metrics) */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }

    .metric-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 14px 16px;
      transition: border-color 0.15s;
    }

    .metric-card:hover {
      border-color: #484f58;
    }

    .metric-label {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--text-muted);
      letter-spacing: 0.04em;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .metric-val {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-main);
      font-family: var(--mono-font);
      letter-spacing: -0.02em;
    }

    .metric-sub {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .progress-track {
      width: 100%;
      height: 4px;
      background: var(--surface-subtle);
      border-radius: 2px;
      overflow: hidden;
      margin-top: 8px;
    }

    .progress-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 2px;
      transition: width 0.3s ease;
    }

    /* Pipeline Stepper (7 Stages) */
    .section-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .pipeline-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 8px;
      margin-bottom: 24px;
    }

    .stage-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      position: relative;
      transition: background 0.15s, border-color 0.15s;
    }

    .stage-card.completed {
      border-color: rgba(46, 160, 67, 0.4);
      background: #101913;
    }

    .stage-card.active {
      border-color: var(--accent);
      border-left: 3px solid var(--accent);
      background: #121c28;
    }

    .stage-card.failed {
      border-color: var(--danger);
      border-left: 3px solid var(--danger);
      background: #1e1315;
    }

    .stage-card.pending {
      opacity: 0.6;
    }

    .stage-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .stage-idx {
      font-family: var(--mono-font);
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
    }

    .stage-card.completed .stage-idx { color: var(--success); }
    .stage-card.active .stage-idx { color: var(--accent); }

    .stage-tag {
      font-size: 10px;
      font-family: var(--mono-font);
      text-transform: uppercase;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 600;
    }

    .tag-completed { background: var(--success-subtle); color: var(--success); }
    .tag-active { background: var(--accent-subtle); color: var(--accent); }
    .tag-failed { background: var(--danger-subtle); color: var(--danger); }
    .tag-pending { background: var(--surface-subtle); color: var(--text-dim); }

    .stage-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-main);
    }

    .stage-agent {
      font-family: var(--mono-font);
      font-size: 11px;
      color: var(--text-muted);
    }

    .stage-desc {
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.35;
    }

    .stage-steps { list-style: none; margin-top: 4px; padding-top: 6px; border-top: 1px dashed var(--border-muted); display: flex; flex-direction: column; gap: 3px; }
    .step { display: flex; gap: 6px; font-size: 11px; line-height: 1.3; color: var(--text-dim); }
    .step-mark { width: 12px; flex: none; font-family: var(--mono-font); }
    .step-text em { display: block; font-style: normal; font-size: 10px; color: var(--text-dim); overflow-wrap: anywhere; }
    .step-done { color: var(--text-muted); }
    .step-done .step-mark { color: var(--success); }
    .step-active { color: var(--text-main); }
    .step-active .step-mark { color: var(--accent); }
    .step-fail { color: var(--danger); }
    .step-fail .step-mark { color: var(--danger); }
    .stage-time { font-family: var(--mono-font); font-size: 10px; color: var(--text-dim); margin-top: auto; padding-top: 4px; }
    .stage-card.pending .stage-steps { display: none; }

    .art-dots { display: inline-flex; gap: 3px; margin-right: 6px; }
    .art-dot { font-family: var(--mono-font); font-size: 10px; min-width: 20px; text-align: center; padding: 1px 4px; border-radius: 4px; border: 1px solid var(--border); color: var(--text-dim); }
    .art-dot.art-on { color: var(--success); border-color: rgba(46, 160, 67, 0.5); background: var(--success-subtle); }
    .gate-meta { padding: 8px 16px; font-size: 11px; color: var(--text-muted); border-top: 1px solid var(--border-muted); }
    .gate-log { margin: 0; padding: 8px 16px; font-family: var(--mono-font); font-size: 10.5px; line-height: 1.4; color: #ffa198; background: #1a1114; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 140px; overflow: auto; border-top: 1px solid var(--border-muted); }

    /* Main Grid Layout */
    .layout-grid {
      display: grid;
      grid-template-columns: 3fr 2fr;
      gap: 20px;
      align-items: start;
    }

    @media (max-width: 960px) {
      .layout-grid { grid-template-columns: 1fr; }
    }

    /* Box / Panel Component */
    .box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }

    .box-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      background: #141920;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .box-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .box-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Search & Filter Bar */
    .filter-bar {
      padding: 10px 16px;
      border-bottom: 1px solid var(--border-muted);
      background: var(--surface);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .search-input {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 12px;
      color: var(--text-main);
      font-family: var(--mono-font);
      min-width: 200px;
      outline: none;
      transition: border-color 0.15s;
    }

    .search-input:focus {
      border-color: var(--accent);
    }

    .filter-btn-group {
      display: flex;
      gap: 4px;
    }

    .filter-chip {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      font-size: 11px;
      font-family: var(--mono-font);
      padding: 3px 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }

    .filter-chip:hover {
      background: var(--surface-subtle);
      color: var(--text-main);
    }

    .filter-chip.active {
      background: var(--surface-subtle);
      border-color: var(--border);
      color: var(--text-main);
      font-weight: 600;
    }

    /* Requirements Cards */
    .req-list {
      display: flex;
      flex-direction: column;
    }

    .req-card {
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      transition: background 0.15s;
    }

    .req-card:last-child {
      border-bottom: none;
    }

    .req-summary {
      padding: 10px 16px;
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      list-style: none;
      transition: background 0.1s ease;
    }

    .req-summary::-webkit-details-marker { display: none; }
    .req-summary:hover { background: var(--surface-hover); }

    .req-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 0;
    }

    .req-icon {
      font-size: 9px;
      color: var(--text-dim);
      transition: transform 0.15s;
    }

    .req-card[open] .req-icon {
      transform: rotate(90deg);
      color: var(--text-muted);
    }

    .req-id-badge {
      font-family: var(--mono-font);
      font-weight: 600;
      font-size: 12px;
      color: var(--accent);
      background: var(--accent-subtle);
      border: 1px solid rgba(56, 139, 253, 0.3);
      padding: 2px 7px;
      border-radius: 4px;
      white-space: nowrap;
    }

    .req-desc-short {
      font-size: 13px;
      color: var(--text-main);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    .req-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .req-pill {
      font-family: var(--mono-font);
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      border: 1px solid transparent;
    }

    .req-passed {
      background: var(--success-subtle);
      color: var(--success);
      border-color: rgba(46, 160, 67, 0.3);
    }

    .req-pending {
      background: var(--warning-subtle);
      color: var(--warning);
      border-color: rgba(187, 128, 9, 0.3);
    }

    .req-blocked {
      background: var(--danger-subtle);
      color: var(--danger);
      border-color: rgba(248, 81, 73, 0.3);
    }

    .req-stale {
      background: var(--purple-subtle);
      color: var(--purple);
      border-color: rgba(163, 113, 247, 0.3);
    }

    .req-body {
      padding: 14px 16px 16px 36px;
      background: #0f1318;
      border-top: 1px solid var(--border-muted);
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 13px;
    }

    .req-detail-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .req-detail-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.04em;
    }

    .req-text-block {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 12px;
      color: var(--text-main);
      line-height: 1.5;
    }

    .criteria-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .criteria-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      color: var(--text-main);
      font-size: 12px;
      line-height: 1.45;
    }

    .criteria-mark {
      color: var(--success);
      font-weight: bold;
      font-size: 13px;
    }

    .ref-chips-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .ref-chip {
      font-family: var(--mono-font);
      font-size: 11px;
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 3px 8px;
      border-radius: 4px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ref-kind-tag {
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .ref-kind-impl, .ref-kind-implementation { background: var(--accent-subtle); color: var(--accent); }
    .ref-kind-test, .ref-kind-tests { background: var(--success-subtle); color: var(--success); }
    .ref-kind-evidence { background: var(--warning-subtle); color: var(--warning); }

    /* Empty filter state */
    .req-empty-msg {
      display: none;
      padding: 24px 16px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }

    /* Right Column / Quality & Attestation Tables */
    .gate-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 11px 16px;
      border-bottom: 1px solid var(--border-muted);
      font-size: 13px;
    }

    .gate-item:last-child {
      border-bottom: none;
    }

    .gate-title-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .gate-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-main);
      font-weight: 500;
    }

    .gate-sub {
      font-size: 11px;
      color: var(--text-muted);
    }

    .gate-pass {
      color: var(--success);
      font-family: var(--mono-font);
      font-size: 11px;
      font-weight: 600;
      background: var(--success-subtle);
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid rgba(46, 160, 67, 0.3);
      white-space: nowrap;
    }

    .gate-wait {
      color: var(--text-dim);
      font-family: var(--mono-font);
      font-size: 11px;
      background: var(--surface-subtle);
      padding: 2px 8px;
      border-radius: 4px;
      white-space: nowrap;
    }

    .gate-fail {
      color: var(--danger);
      font-family: var(--mono-font);
      font-size: 11px;
      font-weight: 600;
      background: var(--danger-subtle);
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid rgba(248, 81, 73, 0.3);
      white-space: nowrap;
    }

    /* Warnings / Preflight */
    .warning-item {
      padding: 10px 16px;
      background: #1b1411;
      border-bottom: 1px solid #382319;
      color: #ffaa80;
      font-size: 12px;
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .warning-item:last-child {
      border-bottom: none;
    }

    footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--text-dim);
      font-size: 12px;
      font-family: var(--mono-font);
      flex-wrap: wrap;
      gap: 8px;
    }

    footer code {
      color: var(--text-muted);
    }
`;
