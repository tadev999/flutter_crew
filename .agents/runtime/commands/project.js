'use strict';

const { writeProfile, detectProfile } = require('../profile');
const { doctor, renderDoctor } = require('../doctor');
const { parseArgs } = require('./args');

/** Generate/refresh docs/fluttercrew/project-profile.md (hand-written conventions are kept). */
function profile(ctx, args = []) {
  const { root } = ctx;
  const { flags } = parseArgs(args);
  if (flags.has('--json')) {
    const detected = detectProfile(root);
    console.log(JSON.stringify(detected, null, 2));
    return detected;
  }
  const result = writeProfile(root);
  console.log(result.written
    ? `Project profile written: ${result.file}. Agents must follow the detected stack.`
    : 'No pubspec.yaml found; run inside a Flutter project root.');
  return result;
}

/** Diagnose the local environment. Exit code 1 when a blocking problem exists. */
function doctorCommand(ctx, args = []) {
  const { root, store } = ctx;
  const { flags } = parseArgs(args);
  const backend = store.exists() ? store.load().backend : undefined;
  const result = doctor(root, { backend });
  console.log(flags.has('--json') ? JSON.stringify(result, null, 2) : renderDoctor(result));
  if (!result.ok) throw new Error('doctor: blocking environment problems found.');
  return result;
}

module.exports = { profile, doctor: doctorCommand };
