'use strict';

const { buildReport } = require('../report');
const { syncFeatures } = require('../features');
const { parseArgs } = require('./args');

/** feature sync: update docs/features/ from the current spec and traces. */
function feature(ctx, args) {
  const { root, store } = ctx;
  const [action] = parseArgs(args).positional;
  if (action !== 'sync') throw new Error('Usage: feature sync');
  const { report } = buildReport(root, store.load());
  if (report.specIssues.length) throw new Error(report.specIssues.join('\n'));
  const result = syncFeatures(root, report.requirementStatus);
  console.log(result.written.length
    ? `Feature catalog updated: ${result.written.join(', ')}`
    : 'Feature catalog already current.');
  const pending = report.requirementStatus.filter((entry) => entry.feature && entry.status !== 'passed');
  if (pending.length) {
    console.log(`Recorded interim statuses for ${pending.map((entry) => entry.id).join(', ')}; sync again once they pass.`);
  }
  console.log('Review each touched FEATURE.md: replace every _TODO_ and delete the FLUTTERCREW-DRAFT line before finish.');
  return result;
}

module.exports = { feature };
