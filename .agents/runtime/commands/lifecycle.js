'use strict';

const path = require('node:path');
const { BACKENDS } = require('../constants');
const { hashFile, read, resolveProjectFile } = require('../fsutil');
const { validateSpec } = require('../spec');
const { newManifest } = require('../state');
const { specStatus, buildReport } = require('../report');
const { archiveRun } = require('../archive');
const { writeDashboard } = require('../dashboard');
const { openBrowser } = require('../platform');
const { ensureWatcher } = require('../watcher');
const { parseArgs } = require('./args');

/** After rendering: optionally open the browser and make sure the live watcher runs. */
function present(ctx, flags, htmlPath) {
  if (flags.has('--open') || (!flags.has('--no-open') && ctx.interactive)) openBrowser(htmlPath);
  if (ctx.interactive && !flags.has('--no-watch')) ensureWatcher(ctx.root, ctx.entry);
}

function start(ctx, args) {
  const { root, store } = ctx;
  const { positional: [requirements, backend], flags } = parseArgs(args);

  // Validate the new run's inputs first so a bad call never archives the current run.
  resolveProjectFile(root, requirements);
  if (!read(path.join(root, requirements)).trim()) throw new Error('Requirements file is empty.');
  if (!BACKENDS.includes(backend)) throw new Error(`Explicit backend required: ${BACKENDS.join('|')}`);

  if (store.exists()) {
    if (flags.has('--archive')) {
      archiveRun(root, store, undefined, { keep: [requirements] });
    } else if (buildReport(root, store.load()).report.status === 'done') {
      throw new Error('Previous run is completed (DONE). Run "crew.js archive [label]" to archive it, or pass --archive to auto-archive.');
    } else {
      throw new Error('Run already exists. Resume it or archive .fluttercrew first.');
    }
  }

  const manifest = newManifest({ requirements, backend });
  store.save(manifest);
  const htmlPath = writeDashboard(root, buildReport(root, manifest).report);
  console.log('Run created. Follow .agents/workflows/feature-delivery.md');
  console.log(`📊 Live Dashboard: file://${path.resolve(htmlPath)}`);
  present(ctx, flags, htmlPath);
  return manifest;
}

function spec(ctx, args) {
  const { root, store } = ctx;
  const manifest = store.load();
  const [specPath, changeReport] = parseArgs(args).positional;
  const file = resolveProjectFile(root, specPath);
  const parsed = validateSpec(JSON.parse(read(file)));
  const digest = hashFile(file);
  const briefHash = hashFile(resolveProjectFile(root, manifest.requirements));

  const unchanged = manifest.spec?.hash === digest && manifest.spec.requirementsHash === briefHash &&
    manifest.spec.path === specPath && specStatus(root, manifest).issues.length === 0;
  if (unchanged) {
    console.log('Spec baseline unchanged; existing verification preserved.');
    return manifest;
  }

  let change = null;
  if (manifest.spec) {
    if (!changeReport) throw new Error('Spec revision requires a reviewed scope/impact report: spec <spec.json> <change.md>');
    const report = resolveProjectFile(root, changeReport);
    if (!read(report).trim() || report === file || report === store.realPath() ||
        report === resolveProjectFile(root, manifest.requirements)) {
      throw new Error('Change report must be a separate non-empty evidence file.');
    }
    change = { evidence: changeReport, hash: hashFile(report) };
    (manifest.specHistory ??= []).push(manifest.spec);
  }

  manifest.spec = {
    path: specPath, hash: digest, requirementsHash: briefHash,
    revision: (manifest.spec?.revision || 0) + 1,
    ids: parsed.requirements.map((entry) => entry.id), change, at: new Date().toISOString()
  };
  Object.assign(manifest, { schemaVersion: 2, traceability: {}, acceptance: {}, verification: null, status: 'in_progress' });
  store.save(manifest);
  console.log('Spec baselined. Revisions invalidate approval, tasks, ALL traces, verification and review attestations.');
  return manifest;
}

function approve(ctx, args) {
  const { root, store } = ctx;
  const manifest = store.load();
  if (!manifest.spec) throw new Error('Cannot approve before spec is baselined. Run spec <spec.json> first.');
  const spec = specStatus(root, manifest);
  if (spec.issues.length) throw new Error(spec.issues.join('\n'));
  const [notes] = parseArgs(args).positional;
  manifest.approved = {
    at: new Date().toISOString(), notes: notes || 'Developer approved requirements scope',
    specRevision: manifest.spec.revision, specHash: manifest.spec.hash,
    requirementsHash: manifest.spec.requirementsHash
  };
  store.save(manifest);
  writeDashboard(root, buildReport(root, manifest).report);
  console.log(`Developer approval recorded: ${manifest.approved.notes}`);
  return manifest;
}

function archive(ctx, args) {
  const { root, store } = ctx;
  if (!store.exists()) {
    console.log('No active run found. Workspace is clean.');
    return null;
  }
  const result = archiveRun(root, store, parseArgs(args).positional[0]);
  console.log('✨ Clean slate ready for next feature run: node .agents/runtime/crew.js start <brief> <backend>');
  return result;
}

module.exports = { start, spec, approve, archive, present };
