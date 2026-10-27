'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { LIMITS, PATHS } = require('./constants');
const { read } = require('./fsutil');
const { loadConfig } = require('./config');
const { readDependencies } = require('./profile');

const defaultProbe = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false, timeout: 20000 });
  if (result.error || result.status !== 0) return null;
  return ((result.stdout || '') + (result.stderr || '')).trim().split(/\r?\n/)[0];
};

/**
 * Environment diagnosis. Each check: { name, status: ok|warn|fail, detail, fix }.
 * `probe(command, args)` returns the first output line or null; injectable for tests.
 */
function doctor(root, { backend, probe = defaultProbe } = {}) {
  const checks = [];
  const add = (name, status, detail, fix = '') => checks.push({ name, status, detail, fix });

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  add('Node.js', nodeMajor >= LIMITS.minNodeMajor ? 'ok' : 'fail', `v${process.versions.node}`,
    `Install Node.js ${LIMITS.minNodeMajor}+ to run the FlutterCrew runtime.`);

  const flutter = probe('flutter', ['--version']);
  add('Flutter SDK', flutter ? 'ok' : 'fail', flutter || 'not found on PATH',
    'Install Flutter and make sure `flutter` is on PATH (verify gates need it).');
  const dart = probe('dart', ['--version']);
  add('Dart SDK', dart ? 'ok' : 'fail', dart || 'not found on PATH', 'Dart ships with Flutter; check PATH.');
  const git = probe('git', ['--version']);
  add('git', git ? 'ok' : 'warn', git || 'not found', 'Without git the fix-mode scope guard is skipped.');

  const pubspec = read(path.join(root, 'pubspec.yaml'));
  add('pubspec.yaml', pubspec.trim() ? 'ok' : 'fail', pubspec.trim() ? 'found' : 'missing',
    'Run inside a Flutter project root.');
  const hasMain = fs.existsSync(path.join(root, 'lib')) &&
    fs.readdirSync(path.join(root, 'lib')).some((name) => /^main(_[a-z0-9]+)?\.dart$/.test(name));
  add('Entrypoint', hasMain ? 'ok' : 'warn', hasMain ? 'lib/main*.dart found' : 'no lib/main*.dart');
  add('analysis_options.yaml', fs.existsSync(path.join(root, 'analysis_options.yaml')) ? 'ok' : 'warn',
    fs.existsSync(path.join(root, 'analysis_options.yaml')) ? 'found' : 'missing',
    'Add one (e.g. include flutter_lints) so `flutter analyze` is meaningful.');

  const { all } = readDependencies(pubspec);
  const hasTestLib = all.has('mocktail') || all.has('mockito') || all.has('bloc_test');
  add('Test libraries', hasTestLib ? 'ok' : 'warn', hasTestLib ? 'mock/bloc test library present' : 'none of mocktail/mockito/bloc_test',
    'flutter pub add --dev mocktail bloc_test');

  const config = loadConfig(root);
  add('FlutterCrew config', config.error ? 'fail' : 'ok',
    config.error || (fs.existsSync(path.join(root, PATHS.configFile)) ? PATHS.configFile : 'defaults (no config file)'),
    `Fix ${PATHS.configFile}.`);
  if (config.gates.coverage && !flutter) add('Coverage gate', 'warn', 'enabled but Flutter is unavailable');
  if (config.gates.codegen && !all.has('build_runner')) {
    add('Codegen gate', 'warn', 'enabled but build_runner is not a dependency (gate will be skipped)');
  }

  const detected = backend || (all.has('supabase_flutter') ? 'supabase' : (all.has('firebase_core') ? 'firebase' : 'none'));
  if (detected === 'firebase') {
    const cli = probe('firebase', ['--version']);
    add('Firebase CLI', cli ? 'ok' : 'warn', cli || 'not found', 'npm i -g firebase-tools (needed for rules/emulator checks).');
    add('Firebase config', fs.existsSync(path.join(root, 'firebase.json')) && fs.existsSync(path.join(root, 'firestore.rules'))
      ? 'ok' : 'warn', 'firebase.json + firestore.rules', 'Run `flutterfire configure` and write firestore.rules.');
  }
  if (detected === 'supabase') {
    const cli = probe('supabase', ['--version']);
    add('Supabase CLI', cli ? 'ok' : 'warn', cli || 'not found', 'Install the Supabase CLI (needed for migrations/RLS tests).');
    add('Supabase migrations', fs.existsSync(path.join(root, 'supabase/migrations')) ? 'ok' : 'warn',
      'supabase/migrations', 'Create migrations with RLS policies.');
  }
  return { backend: detected, ok: checks.every((entry) => entry.status !== 'fail'), checks };
}

function renderDoctor(result) {
  const icon = { ok: 'OK  ', warn: 'WARN', fail: 'FAIL' };
  const lines = [`FlutterCrew doctor (backend: ${result.backend})`];
  for (const entry of result.checks) {
    lines.push(`  [${icon[entry.status]}] ${entry.name}: ${entry.detail}`);
    if (entry.status !== 'ok' && entry.fix) lines.push(`         -> ${entry.fix}`);
  }
  lines.push(result.ok ? 'Ready.' : 'Blocking problems found; fix the FAIL items first.');
  return lines.join('\n');
}

module.exports = { doctor, renderDoctor };
