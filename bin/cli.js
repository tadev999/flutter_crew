#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const readline = require('node:readline');
const { install, uninstall, safePath } = require('./installer');
const { COMMANDS } = require('../.agents/runtime/commands');

const rootSource = path.resolve(__dirname, '..');
const installAgentsTo = (target, options) => install(rootSource, target, options);
const uninstallAgentsFrom = (target, options) => uninstall(rootSource, target, options);

function help(command) {
  if (COMMANDS[command]) {
    console.log(`Usage: flutter-crew ${COMMANDS[command].usage}`);
    return;
  }
  console.log(`FlutterCrew — local installer and delivery CLI

Usage:
  flutter-crew install [directory] [--dry-run]
  flutter-crew [directory] [--dry-run]   Legacy install path alias
  flutter-crew uninstall [directory] [--dry-run]   Alias: remove
  flutter-crew init                    Interactive scaffold; aliases: create, new
  flutter-crew doctor [directory]      Read-only local/tool diagnostics
  flutter-crew --help                  Show this help (no writes)
  flutter-crew --version               Show package version (no writes)

No arguments: install in a Flutter project, otherwise start interactive init.
Existing VS Code settings/tasks/extensions are preserved, including JSONC.
Uninstall restores only manifest-owned unchanged files; custom files, edited
files, unrelated backups and .fluttercrew run evidence are never deleted.
The ownership manifest is .fluttercrew-install.json, separate from run state.
Owned .gitignore privacy rules remain while recovery files or evidence remain.
Partial uninstall/no-manifest notices return success for compatibility, not proof
of full removal. Review retained paths; resolve conflicts and rerun uninstall.
Dry run validates and reports without creating files or backups.

Runtime commands (run in the target project):
${Object.values(COMMANDS).filter((entry) => !entry.hidden)
    .map((entry) => `  flutter-crew ${entry.usage}`).join('\n')}

Describe your feature directly in your IDE chat (include FlutterCrew to opt in);
a requirements document is optional. Backend packages alone do not connect a backend.`);
}

function diagnosticTool(tool) {
  const options = { encoding: 'utf8', timeout: 15000 };
  // Flutter's Windows SDK exposes batch launchers, not native executables.
  // Only fixed tool names/arguments enter cmd.exe, never project/user input.
  if (process.platform === 'win32' && ['flutter', 'dart'].includes(tool)) {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', `${tool}.bat --version`], options);
  }
  return spawnSync(tool, ['--version'], options);
}

function doctor(target = '.', { execute = diagnosticTool } = {}) {
  const root = safePath(path.resolve(target));
  let failures = 0;
  const issue = (message) => { failures++; console.log(`WARN: ${message}`); };
  console.log(`FlutterCrew doctor: ${root} (local checks only; no cloud access or run state changes)`);
  for (const tool of ['node', 'flutter', 'dart']) {
    const result = execute(tool);
    if (result.error || result.status !== 0) {
      issue(`${tool} unavailable or failed. ${tool === 'node' ? 'Install Node.js 18+ and add node to PATH.' :
        'Install the Flutter SDK and add its bin directory to PATH (includes flutter and dart).'}`);
    } else {
      console.log(`OK: ${tool}: ${(result.stdout || result.stderr).trim().split(/\r?\n/)[0]}`);
      if (tool === 'node' && Number((result.stdout.match(/v(\d+)/) || [])[1]) < 18) issue('Upgrade Node.js to 18 or newer.');
    }
  }
  const hasFile = (relative) => {
    const full = safePath(root, relative);
    return fs.existsSync(full) && fs.lstatSync(full).isFile();
  };
  if (!hasFile('pubspec.yaml')) issue('Missing pubspec.yaml. Run doctor in a Flutter project or run flutter create <name>.');
  if (!hasFile('lib/main.dart')) issue('Missing lib/main.dart. Restore your Flutter application entry point.');
  if (!hasFile('.agents/runtime/crew.js')) issue('Runtime not installed. Run flutter-crew install in this project.');
  if (!hasFile('.fluttercrew-install.json')) issue('No installer ownership manifest; legacy files will not be removed automatically.');
  if (hasFile('pubspec.yaml')) {
    const pubspec = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8');
    const backends = [];
    if (/^\s*(firebase_core|cloud_firestore|firebase_auth|firebase_storage):/m.test(pubspec)) backends.push('firebase');
    if (/^\s*supabase_flutter:/m.test(pubspec)) backends.push('supabase');
    // Preflight reads these explicit configuration paths and symlink-safe trees.
    for (const relative of ['lib', 'lib/main.dart', 'lib/firebase_options.dart', 'firebase.json',
      'firestore.rules', 'firestore.indexes.json', 'storage.rules', 'supabase/migrations']) safePath(root, relative);
    const { preflight } = require('../.agents/runtime/preflight');
    const issues = new Set();
    for (const backend of backends.length ? backends : ['none']) {
      console.log(`Detected backend: ${backend} (capability-aware static checks).`);
      for (const message of preflight(root, backend)) issues.add(message);
    }
    for (const message of issues) issue(`${message} Review local application initialization/configuration and backend authorization before delivery.`);
  }
  console.log('Static presence checks do not prove backend connectivity or authorization. No secrets were displayed.');
  if (failures) process.exitCode = 1;
  return { issues: failures };
}

function promptQuestion(rl, query, defaultValue) {
  return new Promise((resolve, reject) => {
    const closed = () => reject(new Error('Input closed. Re-run init in an interactive terminal, or use install <directory>.'));
    rl.once('close', closed);
    rl.question(`${query} (${defaultValue}): `, (answer) => {
      rl.removeListener('close', closed);
      resolve(answer.trim() || defaultValue);
    });
  });
}

function createIfAbsent(root, relative, contents) {
  const full = safePath(root, relative);
  if (fs.existsSync(full)) {
    console.log(`Preserved existing ${relative} unchanged.`);
    return;
  }
  fs.writeFileSync(full, contents, { flag: 'wx' });
}

async function runInteractiveInit() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('init requires an interactive terminal. Create a project with flutter create <name>, then run flutter-crew install <directory>.');
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('FlutterCrew — Flutter project scaffolder');
    const projectName = (await promptQuestion(rl, 'Project name (snake_case)', 'my_flutter_app'))
      .toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!/^[a-z][a-z0-9_]*$/.test(projectName)) throw new Error('Use a project name beginning with a letter.');
    const projectDir = safePath(process.cwd(), projectName);
    if (fs.existsSync(projectDir)) {
      const answer = await promptQuestion(rl, 'Directory exists. Install inside it? (y/n)', 'n');
      if (answer.toLowerCase() !== 'y') return;
    }
    const platform = await promptQuestion(rl, 'Platforms: 1 mobile, 2 mobile/web, 3 all', '1');
    const backend = await promptQuestion(rl, 'Backend: 1 Supabase, 2 Firebase, 3 none', '1');
    const state = await promptQuestion(rl, 'State: 1 BLoC/Cubit, 2 Riverpod, 3 Provider', '1');
    if (![platform, backend, state].every((value) => ['1', '2', '3'].includes(value))) {
      throw new Error('Choose 1, 2 or 3 for platforms, backend and state management.');
    }
    rl.close();
    const platforms = { 1: 'ios,android', 2: 'ios,android,web', 3: 'ios,android,web,macos,windows,linux' }[platform];
    if (!fs.existsSync(safePath(projectDir, 'pubspec.yaml'))) {
      execFileSync('flutter', ['create', `--platforms=${platforms}`, projectName], { stdio: 'inherit' });
    }
    const deps = ['flutter_secure_storage', 'go_router', 'intl'];
    const devDeps = ['flutter_lints'];
    if (state === '1') { deps.push('flutter_bloc', 'equatable'); devDeps.push('mocktail', 'bloc_test'); }
    else deps.push(state === '2' ? 'flutter_riverpod' : 'provider');
    if (backend === '1') deps.push('supabase_flutter');
    if (backend === '2') deps.push('firebase_core', 'firebase_auth', 'cloud_firestore', 'firebase_storage');
    execFileSync('flutter', ['pub', 'add', ...deps], { cwd: projectDir, stdio: 'inherit' });
    execFileSync('flutter', ['pub', 'add', '--dev', ...devDeps], { cwd: projectDir, stdio: 'inherit' });
    const folders = ['lib/core/constants', 'lib/core/errors', 'lib/core/theme', 'lib/core/utils',
      'lib/core/services', ...['models', 'services', 'viewmodels', 'views/pages', 'views/widgets']
        .map((name) => `lib/features/home/${name}`)];
    if (backend === '1') folders.push('supabase/migrations');
    for (const folder of folders) fs.mkdirSync(safePath(projectDir, folder), { recursive: true });
    if (backend === '1') {
      createIfAbsent(projectDir, '.env.example',
        'SUPABASE_URL=https://your-project.supabase.co\nSUPABASE_ANON_KEY=your-anon-key\n');
    }
    if (backend === '2') {
      createIfAbsent(projectDir, 'firestore.rules',
        "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if false;\n    }\n  }\n}\n");
    }
    installAgentsTo(projectDir);
    console.log(`Project ready. cd "${projectName}" and open your IDE.`);
    console.log('Describe your feature directly in chat with FlutterCrew; an optional requirements document is also supported.');
    console.log('Backend packages are installed, not connected. Complete project configuration and delivery gates.');
  } finally {
    rl.close();
  }
}

async function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  if (argv.includes('--help') || command === 'help' || command === '-h') {
    const topic = command === 'help' ? rest[0] : command;
    if (argv.length > (command === 'help' ? 2 : command === '--help' || command === '-h' ? 1 : 2) ||
        argv.some((value) => value.startsWith('-') && !['--help', '-h'].includes(value))) {
      throw new Error('Invalid help arguments. Use flutter-crew --help.');
    }
    help(topic);
    return;
  }
  if (command === '--version' || command === '-v') {
    if (rest.length) throw new Error('--version takes no arguments.');
    console.log(require('../package.json').version);
    return;
  }
  if (Object.hasOwn(COMMANDS, command)) {
    const allowed = command === 'start' ? ['--archive'] : command === 'dashboard' ? ['--open', '--no-open'] : [];
    const unknown = rest.find((value) => value.startsWith('-') && !allowed.includes(value));
    if (unknown) throw new Error(`Unknown flag: ${unknown}. Use flutter-crew ${command} --help.`);
    return require('../.agents/runtime/crew').run(argv);
  }
  const unknown = argv.find((value) => value.startsWith('-') && value !== '--dry-run');
  if (unknown) throw new Error(`Unknown flag: ${unknown}. Use flutter-crew --help.`);
  const dryRun = argv.includes('--dry-run');
  const positional = argv.filter((value) => value !== '--dry-run');
  const [name, ...args] = positional;
  if (['init', 'create', 'new'].includes(name)) {
    if (dryRun || args.length) throw new Error('init takes no arguments and requires an interactive terminal.');
    return runInteractiveInit();
  }
  if (['install', 'uninstall', 'remove', 'doctor'].includes(name)) {
    if (args.length > 1 || (name === 'doctor' && dryRun)) throw new Error(`Invalid ${name} arguments. Use flutter-crew --help.`);
    if (name === 'doctor') return doctor(args[0]);
    return (name === 'install' ? installAgentsTo : uninstallAgentsFrom)(args[0] || '.', { dryRun });
  }
  if (positional.length > 1) throw new Error('Expected one target directory. Use flutter-crew --help.');
  if (!name && !dryRun && !fs.existsSync(path.join(process.cwd(), 'pubspec.yaml'))) return runInteractiveInit();
  return installAgentsTo(name || '.', { dryRun });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main, installAgentsTo, uninstallAgentsFrom, doctor, createIfAbsent };
