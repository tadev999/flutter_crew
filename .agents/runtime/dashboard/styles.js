'use strict';

const { themeStyles } = require('./theme');

module.exports = `
  ${themeStyles}
  :root {
    --mono: "JetBrains Mono", "Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    --ease: cubic-bezier(.2, .7, .2, 1);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  [hidden] { display: none !important; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  body { background: var(--bg); color: var(--text-main); font: 14px/1.6 var(--mono); padding: 24px; -webkit-font-smoothing: antialiased; }
  .container { max-width: 1280px; margin: auto; }
  button, input, select, textarea { font: inherit; }
  button, summary, select { cursor: pointer; }
  a { color: var(--accent); }
  code, time { font-family: var(--mono); }
  code { overflow-wrap: anywhere; }
  h2 { font-size: 15px; font-weight: 600; }
  h3 { font-size: 13px; font-weight: 600; }
  p, strong, dd { overflow-wrap: anywhere; }
  .tone-neutral { --tone: var(--text-muted); }
  .tone-success { --tone: var(--success); }
  .tone-info { --tone: var(--accent); }
  .tone-warning { --tone: var(--warning); }
  .tone-danger { --tone: var(--danger); }
  .page-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
  .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .brand > div { min-width: 0; }
  .logo-badge { flex: none; border: 1px solid var(--accent); border-radius: 3px; padding: 8px; color: var(--accent); font: 600 12px var(--mono); }
  .eyebrow { color: var(--text-muted); font-size: 11px; letter-spacing: .05em; text-transform: uppercase; }
  .brand-title { font-size: 17px; font-weight: 600; letter-spacing: -.035em; overflow-wrap: anywhere; }
  .header-actions, .box-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .header-actions { flex-shrink: 0; max-width: 45%; }
  .chip { font: 11px var(--mono); color: var(--text-muted); padding: 5px 8px; border: 1px solid var(--border); border-radius: 5px; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 7px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-main); font-size: 12px; font-weight: 500; text-decoration: none; transition: background .16s, border-color .16s, transform .16s var(--ease); }
  .btn:hover { background: var(--surface-hover); border-color: var(--text-muted); transform: translateY(-1px); }
  .btn:active { transform: scale(.98); }
  .btn-primary { background: var(--primary-bg); border-color: var(--border); color: var(--primary-text); }
  .btn-primary:hover { background: var(--primary-hover); border-color: var(--accent); }
  .btn-sm { min-height: 30px; padding: 5px 8px; font-size: 11px; }
  .auto-refresh-toggle { display: inline-flex; gap: 6px; align-items: center; color: var(--text-muted); font-size: 11px; min-height: 36px; cursor: pointer; }
  input[type=checkbox] { accent-color: var(--accent); }
  .refresh-icon { display: inline-block; }
  .is-refreshing .refresh-icon { animation: refresh-turn .4s ease-out; }
  .box { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; min-width: 0; overflow: hidden; }
  .box-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--border-muted); }
  .section-meta, .detail-note { font-size: 11px; color: var(--text-muted); }
  .detail-note { margin-top: 7px; }
  .hero { display: grid; grid-template-columns: minmax(0, 1fr) auto; border-left: 3px solid var(--tone); margin-bottom: 16px; }
  .work-overview { margin-bottom: 16px; }
  .work-overview > .stage-summary { padding: 6px 12px; }
  .attention-strip { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; padding: 8px 12px; border-top: 1px solid var(--border-muted); border-left: 3px solid var(--warning); font-size: 12px; }
  .attention-strip > strong { color: var(--warning); }
  .attention-strip > details { flex-basis: 100%; }
  .remaining-work { margin-top: 16px; padding: 10px 12px; }
  .command-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .command-row code { flex: 1; min-width: 0; }
  .current-work { grid-column: 1 / -1; display: flex; align-items: center; flex-wrap: wrap; gap: 6px 12px; padding: 8px 12px; border-bottom: 1px solid var(--border-muted); }
  .current-work-items { display: flex; flex-wrap: wrap; gap: 6px 12px; min-width: 0; }
  .current-work-link { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; text-decoration: none; overflow-wrap: anywhere; }
  .current-work-link:hover { text-decoration: underline; }
  .current-work-note { color: var(--text-muted); font-size: 10px; }
  #more-current-work .current-work-items { padding-top: 8px; }
  .req-card { scroll-margin-top: 12px; }
  .hero-main { display: flex; gap: 10px; padding: 12px; }
  .status-symbol { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 30px; height: 30px; border: 1px solid var(--tone); border-radius: 50%; color: var(--tone); font: 600 16px var(--mono); }
  .hero-copy { min-width: 0; }
  .hero-copy h2 { margin: 2px 0 4px; font-size: 16px; line-height: 1.4; letter-spacing: -.025em; }
  .hero-copy > p:not(.eyebrow) { color: var(--text-muted); font-size: 13px; }
  .hero-copy .retained-summary { margin-top: 7px; font-size: 12px; }
  .stage-summary { display: block; font-size: 11px; text-decoration: none; overflow-wrap: anywhere; }
  .stage-summary:hover { text-decoration: underline; }
  .runtime-state { text-transform: none; letter-spacing: 0; }
  .hero-actions { display: flex; align-items: center; gap: 8px; padding: 12px; }
  .hero > details, .hero > .copy-feedback, .hero > .manual-copy { grid-column: 1 / -1; }
  .action-context { padding: 0 12px; }
  .action-context > summary { padding: 6px 0; color: var(--text-muted); font-size: 11px; }
  .action-context p { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
  .next-owner { color: var(--text-muted); font-size: 11px; margin-right: auto; }
  .next-owner strong { font-weight: 500; color: var(--text-main); }
  .copy-feedback:not(:empty) { padding: 0 20px 14px 64px; font-size: 12px; color: var(--text-main); }
  .manual-copy { display: block; padding: 0 20px 16px; font-size: 12px; color: var(--warning); }
  .manual-copy textarea { width: 100%; margin-top: 6px; padding: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text-main); font: 12px/1.5 var(--mono); resize: vertical; }
  summary { font-size: 12px; transition: color .15s, background .15s; }
  summary:hover { color: var(--accent); }
  .affected-work { border-top: 1px solid var(--border-muted); padding: 0 12px; }
  .affected-work > summary { padding: 7px 0; color: var(--text-muted); font-size: 11px; }
  .action-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 12px 0 18px; }
  .action-group { min-width: 0; }
  .action-group h3 { margin-bottom: 5px; }
  .count { font-size: 11px; color: var(--text-muted); }
  .action-row { padding: 8px 10px; border-left: 2px solid var(--tone); margin-top: 8px; background: var(--bg); font-size: 12px; }
  .action-row p { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
  .action-command { display: block; font-size: 11px; margin-top: 6px; overflow-wrap: anywhere; }
  .pipeline-panel { min-width: 0; scroll-margin-top: 16px; }
  .pipeline-panel h2::before { content: '~/ '; color: var(--accent); }
  .pipeline-note { color: var(--text-muted); font-size: 11px; margin: 0 0 12px; }
  .pipeline-note > span { color: var(--accent); }
  .section-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .pipeline-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; list-style: none; }
  .pipeline-grid li { min-width: 0; }
  .pipeline-grid li:nth-child(1) { grid-area: 1 / 1; }
  .pipeline-grid li:nth-child(2) { grid-area: 1 / 2; }
  .pipeline-grid li:nth-child(3) { grid-area: 1 / 3; }
  .pipeline-grid li:nth-child(4) { grid-area: 2 / 3; }
  .pipeline-grid li:nth-child(5) { grid-area: 2 / 2; }
  .pipeline-grid li:nth-child(6) { grid-area: 2 / 1; }
  .pipeline-grid li:nth-child(7) { grid-area: 3 / 1; }
  .stage-card { position: relative; width: 100%; height: 100%; min-height: 64px; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: 22px 12px 1fr auto; align-items: center; gap: 4px; text-align: left; padding: 8px; border: 1px solid var(--border); border-radius: 4px; color: var(--text-main); background: var(--surface); transition: border-color .18s, background .18s; }
  .stage-card[aria-current=step] { border-color: var(--tone); box-shadow: inset 0 -2px var(--tone); }
  .stage-number { grid-row: 1; grid-column: 1; display: grid; place-items: center; width: 22px; height: 22px; border: 1px solid var(--tone); border-radius: 4px; color: var(--tone); font: 600 11px var(--mono); }
  .stage-title { grid-column: 1; grid-row: 3; font-size: 11px; line-height: 1.4; font-weight: 600; overflow-wrap: anywhere; }
  .stage-state { grid-column: 1; grid-row: 4; font-size: 10px; line-height: 1.4; color: var(--tone); overflow-wrap: anywhere; }
  .stage-focus { grid-row: 2; grid-column: 1; color: var(--tone); font-size: 9px; font-weight: 700; letter-spacing: 0; }
  .stage-focus::before { content: '> '; }
  .stage-progress { position: absolute; right: 8px; top: 10px; color: var(--accent); }
  .progress-indicator { display: inline-flex; align-items: center; gap: 7px; color: var(--accent); font-size: 10px; margin-top: 6px; }
  .progress-dot { display: inline-block; width: 6px; height: 6px; flex: none; border-radius: 50%; background: currentColor; animation: recorded-progress 2.4s ease-in-out infinite; animation-delay: var(--progress-offset, 0ms); }
  .work-signals { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .todo-label { display: inline-block; color: var(--text-muted); font-size: 10px; margin-top: 6px; }
  .task-record[data-state=in_progress] { outline: 1px solid var(--accent); outline-offset: -1px; }
  @keyframes recorded-progress { 0%, 100% { opacity: .65; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.2); } }
  .stage-link { position: absolute; left: 18px; top: 100%; width: 2px; height: 13px; background: var(--tone); pointer-events: none; transform-origin: center top; --link-x: 1; --link-y: 0; }
  .stage-link::after { content: ''; position: absolute; right: -3px; bottom: 2px; width: 7px; height: 7px; border-top: 2px solid var(--tone); border-right: 2px solid var(--tone); transform: rotate(135deg); }
  .pipeline-grid li:is(:nth-child(1), :nth-child(2)) .stage-link { left: 100%; top: 18px; width: 13px; height: 2px; transform-origin: left center; --link-x: 0; --link-y: 1; }
  .pipeline-grid li:is(:nth-child(1), :nth-child(2)) .stage-link::after { right: 2px; bottom: -3px; transform: rotate(45deg); }
  .pipeline-grid li:is(:nth-child(4), :nth-child(5)) .stage-link { left: auto; right: 100%; top: 18px; width: 13px; height: 2px; transform-origin: right center; --link-x: 0; --link-y: 1; }
  .pipeline-grid li:is(:nth-child(4), :nth-child(5)) .stage-link::after { right: auto; left: 2px; bottom: -3px; transform: rotate(-135deg); }
  .stage-card:is(.is-entering, .is-updated) .stage-link { animation: connect-stages .55s var(--ease) both; animation-delay: var(--enter-delay, 0ms); }
  .stage-card[data-focus=true] .stage-number { animation: focus-stage 2.4s var(--ease) infinite; animation-delay: var(--progress-offset, 0ms); }
  .layout-grid { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(340px, 1fr); gap: 20px; align-items: start; }
  .evidence-column { display: grid; gap: 14px; min-width: 0; }
  .status-label { display: inline-block; color: var(--tone); font: 10px var(--mono); border: 1px solid var(--border); border-radius: 4px; padding: 3px 6px; white-space: nowrap; }
  .filter-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--border-muted); }
  .filter-btn-group { display: flex; flex-wrap: wrap; gap: 3px; }
  .filter-chip { border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--text-muted); font-size: 11px; padding: 5px 7px; min-height: 30px; transition: color .15s, background .15s, transform .15s; }
  .filter-chip:hover, .filter-chip.active { background: var(--surface-hover); color: var(--text-main); border-color: var(--border); }
  .filter-chip:active { transform: scale(.97); }
  .search-input { min-width: 0; width: 100%; border: 1px solid var(--border); background: var(--bg); color: var(--text-main); padding: 7px 10px; border-radius: 5px; font-size: 12px; }
  .req-card { border-bottom: 1px solid var(--border-muted); }
  .req-card:last-of-type { border-bottom: none; }
  .req-summary { display: flex; align-items: center; gap: 10px; padding: 14px 16px; list-style: none; }
  .req-summary::-webkit-details-marker { display: none; }
  .req-summary:hover { background: var(--surface-hover); color: var(--text-main); }
  .req-icon { font-size: 14px; color: var(--text-muted); transition: transform .2s var(--ease); }
  .req-card[open] > summary .req-icon { transform: rotate(90deg); }
  .req-overview { min-width: 0; flex: 1; }
  .req-heading { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; font-size: 12px; }
  .req-id-badge { color: var(--accent); font: 11px var(--mono); white-space: nowrap; }
  .work-summary { display: block; color: var(--text-muted); font-size: 11px; margin-top: 4px; }
  .req-body { padding: 0 16px 14px; }
  .task-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .task-record { border-left: 2px solid var(--tone); border-radius: 4px; background: var(--bg); padding: 10px; min-width: 0; }
  .task-heading { display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
  .task-heading h3 { font-size: 12px; }
  .work-record { font-size: 12px; margin-top: 8px; }
  .work-record time { display: block; color: var(--text-muted); font-size: 10px; margin-top: 2px; }
  .task-validity { font-size: 11px; color: var(--text-muted); margin-top: 5px; }
  .task-validity strong { color: var(--tone); font-weight: 500; }
  .requirement-note { font-size: 12px; margin-top: 10px; color: var(--text-muted); }
  .requirement-actions, .requirement-evidence { margin-top: 12px; border-top: 1px solid var(--border-muted); padding-top: 8px; }
  .requirement-evidence h3 { margin-top: 10px; }
  .criteria-list { padding-left: 18px; margin-top: 6px; font-size: 12px; }
  .criteria-list li + li { margin-top: 4px; }
  .art-dots { display: flex; gap: 5px; flex-wrap: wrap; margin: 10px 0; }
  .art-dot { font: 10px var(--mono); padding: 3px 5px; border: 1px solid var(--border); color: var(--text-muted); border-radius: 4px; }
  .art-on { color: var(--accent); }
  .reference-list { list-style: none; font-size: 11px; overflow-wrap: anywhere; }
  .reference-list li { margin-top: 5px; }
  .reference-list span { color: var(--text-muted); }
  .empty-state, .req-empty-msg { padding: 20px 16px; font-size: 12px; color: var(--text-muted); }
  .req-empty-msg { display: none; }
  .evidence-group { border-bottom: 1px solid var(--border-muted); }
  .evidence-group > summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px; list-style: none; }
  .evidence-group > summary::after { content: '+'; font-family: var(--mono); color: var(--text-muted); }
  .evidence-group[open] > summary::after { content: '-'; }
  .evidence-group summary small { display: block; font-size: 11px; color: var(--text-muted); margin-top: 3px; }
  .evidence-group .detail-note, .gate-meta { padding: 0 14px 10px; font-size: 11px; color: var(--text-muted); overflow-wrap: anywhere; }
  .gate-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 14px; font-size: 12px; }
  .gate-pass, .gate-stale, .gate-fail, .gate-wait { font: 10px var(--mono); white-space: nowrap; }
  .gate-pass { color: var(--success); } .gate-stale { color: var(--warning); }
  .gate-fail { color: var(--danger); } .gate-wait { color: var(--text-muted); }
  .gate-log { padding: 10px 14px; max-height: 140px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--bg); color: var(--danger); font: 11px/1.4 var(--mono); }
  .review-item { border-top: 1px solid var(--border-muted); }
  .integrity-note { font-size: 11px; color: var(--text-muted); padding: 12px 14px; }
  .context-panel > summary, .activity-panel > summary { padding: 12px 14px; }
  .context-panel { margin-top: 12px; }
  .context-panel dl { display: grid; grid-template-columns: 70px minmax(0, 1fr); gap: 8px; padding: 0 14px 14px; font-size: 11px; }
  dt { color: var(--text-muted); }
  .warning-item { font-size: 11px; color: var(--warning); padding: 8px 14px; border-top: 1px solid var(--border-muted); }
  .activity-panel { margin-top: 20px; }
  .activity-panel > summary .section-meta { margin-left: 8px; }
  .activity-list { list-style: none; padding: 0 14px; }
  .activity-list li { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 12px; padding: 8px 0; border-top: 1px solid var(--border-muted); font-size: 12px; }
  .activity-list time { color: var(--text-muted); font-size: 11px; }
  .activity-panel > .detail-note { padding: 8px 14px 14px; }
  footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 20px; color: var(--text-muted); font-size: 11px; }
  .is-entering { animation: settle-in .3s var(--ease) backwards; animation-delay: var(--enter-delay, 0ms); }
  .is-updated { animation: state-highlight .8s var(--ease); }
  .section-meta.is-updated, small.is-updated { animation: value-change .35s var(--ease); }
  .is-updated .status-symbol, .is-updated.completed .stage-number { animation: confirm-state .4s var(--ease); }
  .is-user-toggled[open] > .req-body { animation: settle-in .2s var(--ease); }
  @keyframes settle-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes state-highlight { from { box-shadow: inset 0 0 0 1px var(--tone, var(--accent)); } to { box-shadow: inset 0 0 0 1px transparent; } }
  @keyframes value-change { from { opacity: .6; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes confirm-state { 0% { transform: scale(.85); } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }
  @keyframes refresh-turn { to { transform: rotate(180deg); } }
  @keyframes connect-stages { from { opacity: .3; transform: scale(var(--link-x), var(--link-y)); } to { opacity: 1; transform: scale(1, 1); } }
  @keyframes focus-stage { 0%, 100% { box-shadow: 0 0 0 0 transparent; } 45% { box-shadow: 0 0 0 5px var(--border); background: var(--surface-hover); } }
  @media (max-width: 960px) {
    .page-header { flex-wrap: wrap; gap: 10px; }
    .header-actions { max-width: 100%; }
    .layout-grid { grid-template-columns: minmax(0, 1fr); }
    .evidence-column { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 640px) {
    body { padding: 12px; }
    .brand-title { font-size: 16px; }
    .hero { grid-template-columns: minmax(0, 1fr); }
    .hero-main { padding: 10px 12px 6px; }
    .hero-copy h2 { font-size: 15px; }
    .hero-actions { padding: 0 12px 8px; }
    .next-owner { flex-basis: 100%; }
    .copy-feedback:not(:empty) { padding-left: 12px; }
    .action-groups, .task-grid, .evidence-column { grid-template-columns: minmax(0, 1fr); }
    .btn, .filter-chip, .auto-refresh-toggle { min-height: 44px; }
    .req-summary { flex-wrap: wrap; padding: 12px; }
    .req-overview { flex-basis: calc(100% - 30px); }
    .req-summary > .status-label { margin-left: 22px; }
    .req-body { padding: 0 12px 12px; }
    .activity-list li { grid-template-columns: minmax(0, 1fr); gap: 3px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
    .btn:hover, .btn:active, .stage-card:hover, .filter-chip:active { transform: none; }
  }
`;
