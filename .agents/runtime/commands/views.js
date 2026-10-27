'use strict';

const path = require('node:path');
const { writeDashboard } = require('../dashboard');
const { buildReport, refreshDashboard } = require('../report');
const { watch } = require('../watcher');
const { parseArgs } = require('./args');
const { present } = require('./lifecycle');

const STATUS_ICON = { passed: '✔', done: '✔', valid: '✔', in_progress: '…', pending: '○', stale: '↻', blocked: '✖', failed: '✖', missing: '○' };
const icon = (state) => STATUS_ICON[state] || '·';

/** Compact human-readable run summary (the default `status` stays machine-readable JSON). */
function formatSummary(report) {
  const lines = [];
  lines.push(`FlutterCrew run — ${report.status.toUpperCase()}  (mode: ${report.mode}, backend: ${report.backend})`);
  lines.push(`  Spec: ${report.spec ? `rev ${report.spec.revision}, ${report.spec.ids.length} REQ` : 'not baselined'}` +
    `   Approval: ${report.approvalStatus.status}   Verify: ${report.verificationStatus.status}`);
  if (report.spec?.modeReason) lines.push(`  Mode reason: ${report.spec.modeReason}`);
  for (const entry of report.requirementStatus) lines.push(`  ${icon(entry.status)} ${entry.id}  ${entry.status}  ${entry.description}`);
  const gates = report.verificationStatus.checks.map((check) => `${icon(check.status)} ${check.name}`).join('  ');
  lines.push(`  Gates: ${gates}`);
  const missing = new Set(report.missingOrStaleCriteria);
  lines.push(`  Reviews: ${report.criteria.map((id) => `${missing.has(id) ? '○' : '✔'} ${id}`).join('  ')}`);
  for (const entry of report.preflightSuppressed || []) lines.push(`  ⚠ preflight rule "${entry.rule}" suppressed: ${entry.reason}`);
  return lines.join('\n');
}

/** Text for the single next step, with why and the exact commands. */
function formatNext(report) {
  const action = report.nextAction;
  if (!action) return 'Nothing left to do.';
  const lines = [`Next: ${action.issue}`];
  if (action.cause) lines.push(`  Why: ${action.cause}`);
  action.commands.forEach((cmd, index) => lines.push(`  ${index === 0 ? 'Run' : ' or'}: ${cmd}`));
  const more = report.nextActions.length - 1;
  if (more > 0) lines.push(`  (${more} more step${more === 1 ? '' : 's'} after this)`);
  return lines.join('\n');
}

function status(ctx, args = []) {
  const { root, store } = ctx;
  const manifest = store.load();
  const report = buildReport(root, manifest).report;
  writeDashboard(root, report);
  console.log(parseArgs(args).flags.has('--summary') ? formatSummary(report) : JSON.stringify(report, null, 2));
  return report;
}

/** Print the one next step. `--json` emits it for agents. */
function next(ctx, args = []) {
  const { root, store } = ctx;
  if (!store.exists()) {
    console.log('No active run. Start one: node .agents/runtime/crew.js start docs/fluttercrew/request.md <firebase|supabase|none>');
    return null;
  }
  const report = buildReport(root, store.load()).report;
  console.log(parseArgs(args).flags.has('--json') ? JSON.stringify(report.nextAction, null, 2) : formatNext(report));
  return report.nextAction;
}

function dashboard(ctx, args) {
  const { root, store } = ctx;
  const { htmlPath, report } = refreshDashboard(root, store);
  const fileUrl = `file://${path.resolve(htmlPath)}`;
  console.log(`📊 FlutterCrew Dashboard: ${htmlPath}`);
  console.log(`👉 Open in browser: ${fileUrl}`);
  present(ctx, parseArgs(args).flags, htmlPath);
  return { htmlPath, fileUrl, report };
}

/** Internal: long-running renderer spawned by `start`/`dashboard`. */
function watchCommand(ctx) {
  watch(ctx.root, () => refreshDashboard(ctx.root, ctx.store).report);
  return null;
}

module.exports = { status, next, dashboard, watch: watchCommand, formatSummary, formatNext };
