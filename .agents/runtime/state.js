'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { PATHS, SCHEMA_VERSION } = require('./constants');
const { read, writeJsonAtomic } = require('./fsutil');

/**
 * Persistence for the run manifest (.fluttercrew/run.json).
 * Every command reads and writes state through this single object.
 */
function createStore(root) {
  const file = path.join(root, PATHS.runFile);
  return {
    file,
    exists: () => fs.existsSync(file),
    /** Canonical path, used to forbid run state being passed off as evidence. */
    realPath: () => fs.realpathSync(file),
    load() {
      if (!fs.existsSync(file)) {
        throw new Error('No run. Start with: start <requirements.md> <firebase|supabase|none>');
      }
      const manifest = JSON.parse(read(file));
      manifest.traceability ??= {};
      return manifest;
    },
    save(manifest) { writeJsonAtomic(file, manifest); },
    remove() { fs.rmSync(file, { force: true }); }
  };
}

function newManifest({ requirements, backend }) {
  return {
    schemaVersion: SCHEMA_VERSION, status: 'in_progress', requirements, backend,
    startedAt: new Date().toISOString(), spec: null, tasks: {}, traceability: {}, acceptance: {}, verification: null
  };
}

module.exports = { createStore, newManifest };
