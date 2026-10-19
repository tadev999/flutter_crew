'use strict';

const { snapshot, specStatus } = require('../report');
const { parseArgs } = require('./args');

function task(ctx, args) {
  const { root, store } = ctx;
  const manifest = store.load();
  const spec = specStatus(root, manifest);
  if (spec.issues.length) throw new Error(spec.issues.join('\n'));
  const [id, phase, status, notes] = parseArgs(args).positional;
  if (!spec.requirements.some((entry) => entry.id === id)) throw new Error(`Unknown requirement ID: ${id}`);
  if (!['implementation', 'testing'].includes(phase)) throw new Error('Task phase must be implementation|testing.');
  if (!['pending', 'in_progress', 'done', 'blocked'].includes(status)) {
    throw new Error('Task status must be pending|in_progress|done|blocked.');
  }
  if (!notes?.trim()) throw new Error('Task notes must describe completed work, remaining work or the blocker.');
  manifest.tasks ??= {};
  manifest.tasks[id] ??= {};
  manifest.tasks[id][phase] = {
    status, notes, at: new Date().toISOString(),
    specRevision: manifest.spec.revision, specHash: manifest.spec.hash,
    requirementsHash: manifest.spec.requirementsHash, snapshot: snapshot(root, manifest)
  };
  manifest.status = 'in_progress';
  store.save(manifest);
  console.log(`Recorded ${id} ${phase}: ${status}. Task declarations do not replace traces, verification or review.`);
  return manifest;
}

module.exports = { task };
