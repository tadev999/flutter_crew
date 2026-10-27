'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { PATHS } = require('./constants');
const { read, listFiles, writeFileAtomic } = require('./fsutil');

/** Package names declared under dependencies / dev_dependencies (line-based, no YAML dependency). */
function readDependencies(pubspec) {
  const deps = new Set();
  const dev = new Set();
  let section = null;
  for (const line of pubspec.split(/\r?\n/)) {
    if (/^\S/.test(line) && !line.startsWith('#')) {
      section = /^dependencies\s*:/.test(line) ? deps : (/^dev_dependencies\s*:/.test(line) ? dev : null);
      continue;
    }
    const match = /^ {2}([a-z0-9_]+)\s*:/.exec(line);
    if (section && match) section.add(match[1]);
  }
  return { deps, dev, all: new Set([...deps, ...dev]) };
}

const pick = (all, options) => {
  const found = options.filter(([pkg]) => all.has(pkg)).map(([, label]) => label);
  return [...new Set(found)];
};

/** Detect the stack a project already uses, so agents follow it instead of choosing their own. */
function detectProfile(root) {
  const pubspec = read(path.join(root, 'pubspec.yaml'));
  const { all } = readDependencies(pubspec);
  const lib = path.join(root, 'lib');
  const topLevel = fs.existsSync(lib)
    ? fs.readdirSync(lib, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
    : [];
  const entrypoints = fs.existsSync(lib)
    ? fs.readdirSync(lib).filter((name) => /^main(_[a-z0-9]+)?\.dart$/.test(name)).sort()
    : [];
  const name = /^name\s*:\s*(\S+)/m.exec(pubspec)?.[1] || '';
  const sdk = /^\s*sdk\s*:\s*(.+)$/m.exec(pubspec)?.[1]?.replace(/["']/g, '').trim() || '';

  const layout = fs.existsSync(path.join(lib, 'features')) ? 'feature-first (lib/features/<feature>/...)'
    : (fs.existsSync(path.join(lib, 'src')) ? 'package-style (lib/src/...)'
      : (topLevel.length ? `layer-first (${topLevel.join(', ')})` : 'not detected'));
  const generated = listFiles(lib).some((file) => /\.(?:g|freezed|gr|config)\.dart$/.test(file));

  return {
    name, sdk, layout, entrypoints, topLevel,
    stateManagement: pick(all, [['flutter_bloc', 'BLoC/Cubit'], ['bloc', 'BLoC/Cubit'], ['flutter_riverpod', 'Riverpod'],
      ['riverpod', 'Riverpod'], ['hooks_riverpod', 'Riverpod'], ['provider', 'Provider'], ['get', 'GetX'],
      ['mobx', 'MobX'], ['flutter_mobx', 'MobX'], ['signals', 'Signals']]),
    routing: pick(all, [['go_router', 'go_router'], ['auto_route', 'auto_route'], ['beamer', 'beamer'], ['get', 'GetX routing']]),
    di: pick(all, [['get_it', 'get_it'], ['injectable', 'injectable'], ['flutter_riverpod', 'Riverpod providers'],
      ['provider', 'Provider']]),
    modeling: pick(all, [['freezed', 'freezed'], ['json_serializable', 'json_serializable'],
      ['json_annotation', 'json_serializable'], ['equatable', 'equatable'], ['dart_mappable', 'dart_mappable']]),
    codegen: all.has('build_runner') ? { buildRunner: true, generatedFilesPresent: generated } : { buildRunner: false, generatedFilesPresent: generated },
    backend: pick(all, [['firebase_core', 'Firebase'], ['cloud_firestore', 'Firestore'], ['firebase_auth', 'Firebase Auth'],
      ['supabase_flutter', 'Supabase']]),
    network: pick(all, [['dio', 'dio'], ['http', 'http'], ['retrofit', 'retrofit'], ['chopper', 'chopper']]),
    localStorage: pick(all, [['drift', 'drift'], ['isar', 'isar'], ['hive', 'hive'], ['hive_flutter', 'hive'],
      ['sqflite', 'sqflite'], ['shared_preferences', 'shared_preferences'], ['flutter_secure_storage', 'flutter_secure_storage'],
      ['objectbox', 'objectbox']]),
    localization: pick(all, [['flutter_localizations', 'flutter_localizations'], ['intl', 'intl'],
      ['easy_localization', 'easy_localization'], ['slang', 'slang']]),
    flavors: entrypoints.length > 1 || all.has('flutter_flavorizr') || all.has('flutter_flavor'),
    testing: pick(all, [['mocktail', 'mocktail'], ['mockito', 'mockito'], ['bloc_test', 'bloc_test'],
      ['golden_toolkit', 'golden_toolkit'], ['alchemist', 'alchemist'], ['integration_test', 'integration_test'],
      ['patrol', 'patrol']]),
    lints: pick(all, [['flutter_lints', 'flutter_lints'], ['very_good_analysis', 'very_good_analysis'], ['lint', 'lint'],
      ['lints', 'lints']]),
    hasTests: listFiles(path.join(root, 'test')).some((file) => file.endsWith('_test.dart')),
    hasPubspec: !!pubspec.trim()
  };
}

const line = (label, value) => {
  const text = Array.isArray(value) ? value.join(', ') : value;
  return `- **${label}:** ${text || '_not detected_'}`;
};

/** Markdown agents read before choosing architecture, state management, routing, etc. */
function renderProfile(profile) {
  return `# Project profile

> Auto-detected by \`node .agents/runtime/crew.js profile\` from \`pubspec.yaml\` and \`lib/\`.
> **Agents: follow these existing choices. Do not introduce a competing library
> (second state manager, router, DI container, model generator) without developer approval.**
> Edit the "Conventions" section by hand; it is preserved on regeneration.

## Detected stack

${line('App', profile.name)}
${line('Dart SDK', profile.sdk)}
${line('Layout', profile.layout)}
${line('Entrypoints', profile.entrypoints)}
${line('State management', profile.stateManagement)}
${line('Routing', profile.routing)}
${line('Dependency injection', profile.di)}
${line('Models / serialization', profile.modeling)}
${line('Code generation', profile.codegen.buildRunner
    ? `build_runner${profile.codegen.generatedFilesPresent ? ' (generated files committed)' : ''}` : 'none')}
${line('Backend', profile.backend)}
${line('Networking', profile.network)}
${line('Local storage', profile.localStorage)}
${line('Localization', profile.localization)}
${line('Flavors', profile.flavors ? 'yes' : 'no')}
${line('Test libraries', profile.testing)}
${line('Lints', profile.lints)}
${line('Existing tests', profile.hasTests ? 'yes' : 'none')}

## Rules for agents

- Reuse the detected state management, routing and DI approach for every new feature.
- Match the detected layout; place new files where similar ones already live.
- Run \`dart run build_runner build --delete-conflicting-outputs\` after changing annotated models/providers when build_runner is used.
- Mirror the existing test style and libraries.

${PRESERVED_START}
${DEFAULT_CONVENTIONS}
${PRESERVED_END}
`;
}

const PRESERVED_START = '<!-- fluttercrew:conventions:start -->';
const PRESERVED_END = '<!-- fluttercrew:conventions:end -->';
const DEFAULT_CONVENTIONS = `## Conventions (hand-written)

_Add team rules here: naming, error handling, design system, API style, branch/commit rules._`;

function preservedConventions(existing) {
  const start = existing.indexOf(PRESERVED_START);
  const end = existing.indexOf(PRESERVED_END);
  return start >= 0 && end > start ? existing.slice(start + PRESERVED_START.length, end).trim() : '';
}

/**
 * Write docs/fluttercrew/project-profile.md. Hand-written conventions are kept.
 * With `onlyIfMissing`, an existing profile is never touched.
 */
function writeProfile(root, { onlyIfMissing = false } = {}) {
  const file = path.join(root, PATHS.profileFile);
  const existing = read(file);
  if (onlyIfMissing && existing.trim()) return { file: PATHS.profileFile, written: false };
  const profile = detectProfile(root);
  if (!profile.hasPubspec) return { file: PATHS.profileFile, written: false, profile };
  let markdown = renderProfile(profile);
  const kept = preservedConventions(existing);
  if (kept) markdown = markdown.replace(DEFAULT_CONVENTIONS, kept);
  writeFileAtomic(file, markdown);
  return { file: PATHS.profileFile, written: true, profile };
}

module.exports = { detectProfile, renderProfile, writeProfile, readDependencies };
