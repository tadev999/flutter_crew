'use strict';

const { TRACE_KINDS, CRITERIA } = require('../constants');
const { hashFile, read, resolveProjectFile } = require('../fsutil');
const { validateTrace } = require('../spec');
const { snapshot, specStatus } = require('../report');
const { parseArgs } = require('./args');

/** Record a per-requirement trace: links to real implementation/test/evidence files. */
function trace(ctx, args) {
  const { root, store } = ctx;
  const manifest = store.load();
  const spec = specStatus(root, manifest);
  if (spec.issues.length) throw new Error(spec.issues.join('\n'));

  const [id, reportPath] = parseArgs(args).positional;
  const requirement = spec.requirements.find((entry) => entry.id === id);
  if (!requirement) throw new Error(`Unknown requirement ID: ${id}`);

  const report = resolveProjectFile(root, reportPath);
  if (report === store.realPath()) throw new Error('Run state is not a trace report.');
  const value = validateTrace(JSON.parse(read(report)), requirement);

  const references = [];
  if (value.status === 'passed') {
    const forbidden = [report, store.realPath(), resolveProjectFile(root, manifest.spec.path),
      resolveProjectFile(root, manifest.requirements)];
    for (const kind of TRACE_KINDS) {
      for (const relative of value[kind]) {
        const referenced = resolveProjectFile(root, relative);
        if (forbidden.includes(referenced) || !read(referenced).trim()) {
          throw new Error('Trace references must be non-empty implementation/test/evidence files, not the brief, spec, report or run state.');
        }
        references.push({ kind, evidence: relative, hash: hashFile(referenced) });
      }
    }
  }

  manifest.traceability[id] = {
    status: value.status, notes: value.notes || '', evidence: reportPath, hash: hashFile(report),
    references, testRationale: value.testRationale || '', at: new Date().toISOString()
  };
  manifest.traceability[id].snapshot = snapshot(root, manifest);
  manifest.status = 'in_progress';
  store.save(manifest);
  console.log(`Recorded ${id}: ${value.status}. Artifact links do not prove test execution or semantic coverage.`);
  return manifest;
}

/** Record one of the global review attestations backed by a reviewed evidence report. */
function accept(ctx, args) {
  const { root, store } = ctx;
  const manifest = store.load();
  const [id, evidence] = parseArgs(args).positional;
  if (!CRITERIA.includes(id)) throw new Error(`Criterion must be: ${CRITERIA.join(', ')}`);
  const file = resolveProjectFile(root, evidence);
  if (file === store.realPath()) throw new Error('Run state is not evidence.');
  if (!read(file).trim()) throw new Error('Empty evidence is not accepted.');
  manifest.acceptance[id] = {
    evidence, hash: hashFile(file), snapshot: snapshot(root, manifest), at: new Date().toISOString()
  };
  manifest.status = 'in_progress';
  store.save(manifest);
  console.log(`Recorded ${id} attestation. Evidence content still requires reviewer judgement.`);
  return manifest;
}

module.exports = { trace, accept };
