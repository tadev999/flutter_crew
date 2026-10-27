'use strict';

const { snapshot, specStatus } = require('../report');
const { parseArgs } = require('./args');

const PHASES = ['implementation', 'testing'];
const STATES = ['pending', 'in_progress', 'done', 'blocked'];

/**
 * task <REQ-ID> <phase> <status> <notes>
 * task --all <phase> <status> <notes>        (every requirement in the spec)
 */
function task(ctx, args) {
  const { root, store } = ctx;
  const manifest = store.load();
  const spec = specStatus(root, manifest);
  if (spec.issues.length) throw new Error(spec.issues.join('\n'));
  const { positional, flags } = parseArgs(args);
  const all = flags.has('--all');
  const [id, phase, status, notes] = all ? [null, ...positional] : positional;
  if (!all && !spec.requirements.some((entry) => entry.id === id)) throw new Error(`Unknown requirement ID: ${id}`);
  if (!PHASES.includes(phase)) throw new Error('Task phase must be implementation|testing.');
  if (!STATES.includes(status)) throw new Error('Task status must be pending|in_progress|done|blocked.');
  if (!notes?.trim()) throw new Error('Task notes must describe completed work, remaining work or the blocker.');

  const ids = all ? spec.requirements.map((entry) => entry.id) : [id];
  const record = {
    status, notes, at: new Date().toISOString(),
    specRevision: manifest.spec.revision, specHash: manifest.spec.hash,
    requirementsHash: manifest.spec.requirementsHash, snapshot: snapshot(root, manifest)
  };
  manifest.tasks ??= {};
  for (const target of ids) {
    manifest.tasks[target] ??= {};
    manifest.tasks[target][phase] = { ...record };
  }
  manifest.status = 'in_progress';
  store.save(manifest);
  console.log(`Recorded ${ids.join(', ')} ${phase}: ${status}. Task declarations do not replace traces, verification or review.`);
  return manifest;
}

module.exports = { task };
