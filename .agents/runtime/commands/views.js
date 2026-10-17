'use strict';

const path = require('node:path');
const { writeDashboard } = require('../dashboard');
const { buildReport, guardDoneStatus, refreshDashboard } = require('../report');
const { watch } = require('../watcher');
const { parseArgs } = require('./args');
const { present } = require('./lifecycle');

function status(ctx) {
  const { root, store } = ctx;
  const manifest = store.load();
  const report = guardDoneStatus(root, manifest, buildReport(root, manifest));
  writeDashboard(root, report);
  console.log(JSON.stringify(report, null, 2));
  return report;
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

module.exports = { status, dashboard, watch: watchCommand };
