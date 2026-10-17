'use strict';

const path = require('node:path');
const { PATHS, RUN_DOCUMENTS } = require('./constants');
const { moveInto } = require('./fsutil');
const { writeDashboard } = require('./dashboard');
const { EMPTY_REPORT } = require('./report');

/**
 * Move a finished (or abandoned) run out of the working tree into
 * docs/fluttercrew/history/run-<timestamp>[-label]/ and reset the dashboard,
 * leaving a clean slate for the next feature.
 *
 * @param {string} root project root
 * @param {object} store run-state store
 * @param {string} [label] optional suffix for the archive folder
 * @param {{keep?: string[]}} [options] project-relative files to leave in place
 *   (e.g. the brief a new run is about to start from)
 */
function archiveRun(root, store, label, { keep = [] } = {}) {
  if (!store.exists()) return null;
  const manifest = store.load();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const tag = label ? `-${label.replace(/[^a-zA-Z0-9_-]/g, '')}` : '';
  const archiveDir = path.join(root, PATHS.historyDir, `run-${stamp}${tag}`);
  const at = (...parts) => path.join(root, ...parts);
  const kept = new Set(keep.map((file) => path.normalize(file)));

  moveInto(store.file, path.join(archiveDir, 'run.json'));
  moveInto(at(PATHS.tracesDir), path.join(archiveDir, 'traces'));
  moveInto(at(PATHS.logsDir), path.join(archiveDir, 'logs'));
  moveInto(at(PATHS.evidenceDir), path.join(archiveDir, 'evidence'));
  for (const name of RUN_DOCUMENTS) {
    if (!kept.has(path.normalize(path.join(PATHS.docsDir, name)))) {
      moveInto(at(PATHS.docsDir, name), path.join(archiveDir, name));
    }
  }
  moveInto(at(PATHS.docsDir, 'evidence'), path.join(archiveDir, 'docs-evidence'));

  writeDashboard(root, { ...EMPTY_REPORT });
  console.log(`📦 Previous run archived to: ${path.relative(root, archiveDir)}`);
  return { archiveDir, manifest };
}

module.exports = { archiveRun };
