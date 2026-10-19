'use strict';

/**
 * Single source of truth for names, paths and tunables shared by every runtime
 * module. Change a value here and the runtime, dashboard and pipeline follow.
 */

const SCHEMA_VERSION = 2;
const BACKENDS = Object.freeze(['firebase', 'supabase', 'none']);

/** Global review attestations required before a run can finish. */
const CRITERIA = Object.freeze(['requirements', 'design', 'backend', 'security', 'experience']);

/** Human-readable meaning of each attestation (shown on the dashboard). */
const CRITERIA_DESCRIPTIONS = Object.freeze({
  requirements: 'Spec & acceptance criteria mapping',
  design: 'Visual tokens, theme & UX states',
  backend: 'Database schema, rules & auth proof',
  security: 'Zero-trust storage & permission audit',
  experience: 'Real journey, a11y & responsive check'
});

/** Mechanical quality gates, in execution order. */
const GATES = Object.freeze([
  { name: 'format', label: 'dart format', sub: 'Code formatting style' },
  { name: 'analyze', label: 'flutter analyze', sub: 'Linter & type checking' },
  { name: 'tests', label: 'flutter test', sub: 'Unit & widget test suites' }
]);

/** Artifact kinds a passed trace must link for each requirement. */
const TRACE_KINDS = Object.freeze(['implementation', 'tests', 'evidence']);

/** Directories never hashed, scanned or watched. */
const IGNORED_DIRS = Object.freeze(new Set([
  '.git', '.dart_tool', 'build', 'node_modules', '.gradle', 'Pods',
  '.symlinks', 'ephemeral', '.idea', '.cxx', 'DerivedData'
]));

/** Project inputs whose content invalidates verification when changed. */
const SNAPSHOT_INPUTS = Object.freeze([
  'lib', 'test', 'integration_test', 'assets', 'android', 'ios', 'web', 'macos',
  'windows', 'linux', 'supabase', 'pubspec.yaml', 'pubspec.lock',
  'analysis_options.yaml', 'firebase.json', '.firebaserc', 'firestore.rules',
  'firestore.indexes.json', 'storage.rules', 'functions'
]);

/** Project-relative locations (POSIX separators; always joined with `path`). */
const PATHS = Object.freeze({
  stateDir: '.fluttercrew',
  runFile: '.fluttercrew/run.json',
  logsDir: '.fluttercrew/logs',
  tracesDir: '.fluttercrew/traces',
  evidenceDir: '.fluttercrew/evidence',
  dashboard: '.fluttercrew/dashboard.html',
  watcherPid: '.fluttercrew/watch.pid',
  docsDir: 'docs/fluttercrew',
  historyDir: 'docs/fluttercrew/history'
});

/** Files under docs/fluttercrew that belong to a single run and are archived with it. */
const RUN_DOCUMENTS = Object.freeze(['request.md', 'spec.json', 'change.md']);

const LIMITS = Object.freeze({
  minNodeMajor: 18,
  commandTimeoutMs: 300000,
  commandMaxBuffer: 16 * 1024 * 1024,
  watchIntervalMs: 3000,
  watchMaxAgeMs: 12 * 3600 * 1000,
  scanFileLimit: 5000
});

module.exports = {
  SCHEMA_VERSION, BACKENDS, CRITERIA, CRITERIA_DESCRIPTIONS, GATES, TRACE_KINDS,
  IGNORED_DIRS, SNAPSHOT_INPUTS, PATHS, RUN_DOCUMENTS, LIMITS
};
