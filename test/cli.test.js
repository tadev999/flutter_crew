'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const cli = path.resolve(__dirname, '../bin/cli.js');
const manifestName = '.fluttercrew-install.json';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(__dirname, '.cli-fixture-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name, content) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content);
  };
  const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
  const exists = (name) => fs.existsSync(path.join(root, name));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], {
    cwd: root, encoding: 'utf8', timeout: 30000,
  });
  return { root, write, read, exists, run };
}

function success(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function doctorWithAvailableTools(p) {
  return spawnSync(process.execPath, ['-e',
    `require(${JSON.stringify(cli)}).doctor('.', {
      execute: () => ({ status: 0, stdout: 'v22.0.0', stderr: '' })
    })`], { cwd: p.root, encoding: 'utf8' });
}

function snapshot(root) {
  const result = {};
  function visit(directory, prefix = '') {
    for (const name of fs.readdirSync(directory).sort()) {
      const relative = prefix ? `${prefix}/${name}` : name;
      const full = path.join(directory, name);
      const info = fs.lstatSync(full);
      if (info.isSymbolicLink()) result[relative] = `link:${fs.readlinkSync(full)}`;
      else if (info.isDirectory()) { result[relative] = 'directory'; visit(full, relative); }
      else result[relative] = fs.readFileSync(full).toString('base64');
    }
  }
  visit(root);
  return result;
}

test('help, version and safe import do not write or initialize', (t) => {
  const p = fixture(t);
  const before = snapshot(p.root);
  for (const args of [['--help'], ['-h'], ['help'], ['install', '--help'], ['verify', '--help'], ['--version'], ['-v']]) {
    success(p.run(...args));
  }
  const imported = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(cli)})`], {
    cwd: p.root, encoding: 'utf8',
  });
  success(imported);
  assert.equal(imported.stdout, '');
  assert.deepEqual(snapshot(p.root), before);
  assert.match(p.run('--help').stdout, /requirements document is optional/);
  assert.match(p.run('--help').stdout, /doctor/);
});

test('unknown flags and excess arguments fail without writes', (t) => {
  const p = fixture(t);
  for (const args of [['--wat'], ['install', '--force'], ['uninstall', '--force'], ['doctor', '--dry-run'],
    ['init', '--dry-run'], ['install', '.', 'extra'], ['status', '--wat'], ['--version', 'extra'], ['--help', '--wat']]) {
    const result = p.run(...args);
    assert.equal(result.status, 1, `${args}: ${result.stdout}`);
    assert.match(result.stderr, /Unknown flag|arguments|takes no arguments/);
  }
  assert.deepEqual(snapshot(p.root), {});
});

test('dry-run install, legacy path and uninstall never write', (t) => {
  const p = fixture(t);
  p.write('AGENTS.md', 'custom');
  p.write('.vscode/settings.json', '// JSONC\n{"custom": true}');
  const before = snapshot(p.root);
  const preview = p.run('install', '.', '--dry-run');
  success(preview);
  assert.match(preview.stdout, /REPLACE AGENTS\.md/);
  assert.match(preview.stdout, /BACK UP AGENTS\.md -> AGENTS\.md\.fluttercrew-\d+-[a-f0-9]+\.bak/);
  assert.match(preview.stdout, /ADD \.agents\/runtime\/crew\.js/);
  assert.match(preview.stdout, /WRITE \.fluttercrew-install\.json/);
  success(p.run('.', '--dry-run'));
  success(p.run('install', 'new-project', '--dry-run'));
  assert.deepEqual(snapshot(p.root), before);
  success(p.run('install'));
  const installed = snapshot(p.root);
  const removal = p.run('uninstall', '--dry-run');
  success(removal);
  assert.match(removal.stdout, /RESTORE AGENTS\.md <- AGENTS\.md\.fluttercrew-/);
  assert.match(removal.stdout, /REMOVE \.agents\/runtime\/crew\.js/);
  assert.match(removal.stdout, /CONSUME unchanged owned backup AGENTS\.md\.fluttercrew-/);
  assert.match(removal.stdout, /REMOVE \.fluttercrew-install\.json/);
  assert.deepEqual(snapshot(p.root), installed);
});

test('custom agents/prompts/workflows and JSONC configuration survive install/uninstall', (t) => {
  const p = fixture(t);
  const originals = {
    '.agents/skills/custom/SKILL.md': 'custom skill',
    '.github/prompts/my.prompt.md': 'custom prompt',
    '.github/agents/my.agent.md': 'custom agent',
    '.github/workflows/custom.yml': 'user workflow',
    '.vscode/settings.json': '// settings comment\n{"editor.fontSize": 14,}\n',
    '.vscode/tasks.json': '// tasks\n{"tasks": [],}\n',
    '.vscode/extensions.json': '// extensions\n{"recommendations": ["custom.extension"],}\n',
    '.vscode/settings.json.bak': 'unrelated backup',
    'unrelated.fluttercrew-123.bak': 'never sweep backups',
    '.fluttercrew/run.json': '{"status":"active","evidence":"untouched"}',
    '.fluttercrew/evidence/custom.log': 'recorded evidence',
  };
  for (const [name, contents] of Object.entries(originals)) p.write(name, contents);
  const result = p.run('install');
  success(result);
  assert.match(result.stdout, /Preserved existing .vscode\/settings.json unchanged/);
  for (const [name, contents] of Object.entries(originals)) assert.equal(p.read(name), contents, name);
  assert.equal(p.exists('.github/workflows/ci.yml'), false);
  success(p.run('uninstall'));
  for (const [name, contents] of Object.entries(originals)) assert.equal(p.read(name), contents, name);
  assert.equal(p.exists(manifestName), true);
  assert.match(p.read('.gitignore'), /\.fluttercrew\//);
  assert.deepEqual(Object.keys(JSON.parse(p.read(manifestName)).files), ['.gitignore']);
  success(p.run('uninstall'));
});

test('colliding files restore original contents/modes and installation owns only changed paths', (t) => {
  const p = fixture(t);
  const originals = {
    'AGENTS.md': 'Original instructions',
    '.agents/runtime/crew.js': 'Original runtime',
    '.github/prompts/fluttercrew-deliver.prompt.md': 'Original prompt',
    '.github/agents/fluttercrew.agent.md': 'Original agent',
    '.gitignore': '# personal ignores\nbuild/\n',
  };
  for (const [name, contents] of Object.entries(originals)) p.write(name, contents);
  fs.chmodSync(path.join(p.root, 'AGENTS.md'), 0o640);
  success(p.run('install'));
  const manifest = JSON.parse(p.read(manifestName));
  assert.equal(manifest.version, 1);
  assert.equal(p.exists('.fluttercrew'), false);
  const backup = manifest.files['AGENTS.md'].backup;
  assert.equal(p.read(backup.path), originals['AGENTS.md']);
  assert.notEqual(p.read('AGENTS.md'), originals['AGENTS.md']);
  success(p.run('remove'));
  for (const [name, contents] of Object.entries(originals)) assert.equal(p.read(name), contents);
  assert.equal(fs.statSync(path.join(p.root, 'AGENTS.md')).mode & 0o777, 0o640);
  assert.equal(p.exists('.vscode'), false);
  assert.equal(p.exists(backup.path), false);
});

test('identical preexisting files are not claimed or removed', (t) => {
  const p = fixture(t);
  const original = fs.readFileSync(path.resolve(__dirname, '../AGENTS.md'), 'utf8');
  p.write('AGENTS.md', original);
  success(p.run('install'));
  assert.equal(Object.hasOwn(JSON.parse(p.read(manifestName)).files, 'AGENTS.md'), false);
  success(p.run('uninstall'));
  assert.equal(p.read('AGENTS.md'), original);
});

test('git ignores ownership manifest, recovery backups and evidence with reversible gitignore ownership', (t) => {
  const p = fixture(t);
  success(spawnSync('git', ['init', '--quiet'], { cwd: p.root, encoding: 'utf8' }));
  const originalIgnore = '# developer-local configuration\n.env\n';
  p.write('.gitignore', originalIgnore);
  p.write('AGENTS.md', 'private local instructions');
  success(p.run('install'));
  const manifest = JSON.parse(p.read(manifestName));
  const backup = manifest.files['AGENTS.md'].backup.path;
  assert.match(backup, /^AGENTS\.md\.fluttercrew-\d+-[a-f0-9]+\.bak$/);
  p.write('.fluttercrew/evidence/private.log', 'private evidence');
  const ignored = [manifestName, backup, manifest.files['.gitignore'].backup.path, '.fluttercrew/evidence/private.log'];
  const result = spawnSync('git', ['check-ignore', '--', ...ignored], { cwd: p.root, encoding: 'utf8' });
  success(result);
  assert.deepEqual(new Set(result.stdout.trim().split('\n')), new Set(ignored));
  success(p.run('uninstall'));
  assert.ok(p.read('.gitignore').startsWith(originalIgnore));
  assert.equal(p.read('AGENTS.md'), 'private local instructions');
  assert.equal(p.read('.fluttercrew/evidence/private.log'), 'private evidence');
  assert.match(p.read('.gitignore'), /\.fluttercrew\//);
  fs.rmSync(path.join(p.root, '.fluttercrew'), { recursive: true });
  success(p.run('uninstall'));
  assert.equal(p.read('.gitignore'), originalIgnore);
});

test('partial uninstall keeps privacy ignores until retained files are resolved', (t) => {
  const p = fixture(t);
  p.write('.gitignore', '# original\n');
  p.write('AGENTS.md', 'original instructions');
  success(p.run('install'));
  const manifest = JSON.parse(p.read(manifestName));
  const installed = p.read('AGENTS.md');
  p.write('AGENTS.md', 'developer edits');
  success(p.run('uninstall'));
  const backup = manifest.files['AGENTS.md'].backup.path;
  assert.match(p.read('.gitignore'), /\*\.fluttercrew-\*\.bak/);
  assert.equal(p.exists(backup), true);
  assert.equal(p.exists(manifestName), true);
  p.write('AGENTS.md', installed);
  success(p.run('uninstall'));
  assert.equal(p.read('AGENTS.md'), 'original instructions');
  assert.equal(p.read('.gitignore'), '# original\n');
  assert.equal(p.exists(manifestName), false);
});

test('reinstall refuses missing privacy rules in edited gitignore before creating backups', (t) => {
  const p = fixture(t);
  success(p.run('install'));
  p.write('.gitignore', '# developer custom changes, installer ignores removed\nprivate/\n');
  p.write('.agents/new-local-file', 'developer file');
  const before = snapshot(p.root);
  const result = p.run('install');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Locally modified .gitignore.*missing privacy rules/);
  assert.match(result.stderr, /Add these lines manually/);
  assert.deepEqual(snapshot(p.root), before);
});

test('repeat install is stable, keeps first backups, and local edits survive update/uninstall', (t) => {
  const p = fixture(t);
  p.write('AGENTS.md', 'original');
  success(p.run('install'));
  const once = snapshot(p.root);
  success(p.run('install'));
  assert.deepEqual(snapshot(p.root), once);
  p.write('AGENTS.md', 'locally edited instructions');
  p.write('.agents/runtime/crew.js', 'locally edited runtime');
  p.write('.vscode/tasks.json', 'locally edited tasks');
  p.write('.gitignore', `${p.read('.gitignore')}local-custom-ignore\n`);
  const manifest = JSON.parse(p.read(manifestName));
  success(p.run('install'));
  assert.equal(p.read('AGENTS.md'), 'locally edited instructions');
  const result = p.run('uninstall');
  success(result);
  assert.match(result.stdout, /Partial uninstall/);
  assert.equal(p.read('AGENTS.md'), 'locally edited instructions');
  assert.equal(p.read('.agents/runtime/crew.js'), 'locally edited runtime');
  assert.equal(p.read('.vscode/tasks.json'), 'locally edited tasks');
  assert.match(p.read('.gitignore'), /local-custom-ignore/);
  assert.equal(p.read(manifest.files['AGENTS.md'].backup.path), 'original');
  const retained = snapshot(p.root);
  success(p.run('uninstall'));
  assert.deepEqual(snapshot(p.root), retained);
});

test('package updates replace only unchanged owned content and restore the first original', (t) => {
  const p = fixture(t);
  const { install, uninstall } = require('../bin/installer');
  const source = path.join(p.root, 'distribution');
  const target = path.join(p.root, 'project');
  p.write('distribution/AGENTS.md', 'package v1');
  p.write('project/AGENTS.md', 'original');
  install(source, target);
  const first = JSON.parse(fs.readFileSync(path.join(target, manifestName))).files['AGENTS.md'].backup.path;
  p.write('distribution/AGENTS.md', 'package v2');
  install(source, target);
  assert.equal(fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8'), 'package v2');
  assert.equal(JSON.parse(fs.readFileSync(path.join(target, manifestName))).files['AGENTS.md'].backup.path, first);
  uninstall(source, target);
  assert.equal(fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8'), 'original');
});

test('modified or missing backups are retained and never used for restoration', (t) => {
  const p = fixture(t);
  p.write('AGENTS.md', 'original');
  p.write('CLAUDE.md', 'original Claude');
  success(p.run('install'));
  const manifest = JSON.parse(p.read(manifestName));
  p.write(manifest.files['AGENTS.md'].backup.path, 'edited backup');
  fs.unlinkSync(path.join(p.root, manifest.files['CLAUDE.md'].backup.path));
  const installed = p.read('AGENTS.md');
  const result = p.run('uninstall');
  success(result);
  assert.match(result.stdout, /backup missing or modified/);
  assert.equal(p.read('AGENTS.md'), installed);
  assert.equal(p.read(manifest.files['AGENTS.md'].backup.path), 'edited backup');
  assert.equal(p.exists(manifestName), true);
});

test('legacy uninstall without ownership does not guess or sweep files/backups/run state', (t) => {
  const p = fixture(t);
  p.write('AGENTS.md', 'legacy');
  p.write('AGENTS.md.fluttercrew-123.bak', 'original');
  p.write('.agents/custom.md', 'custom');
  p.write('.fluttercrew/run.json', 'active');
  const before = snapshot(p.root);
  success(p.run('uninstall'));
  assert.deepEqual(snapshot(p.root), before);
});

test('symlink directory/file/manifest/backup escapes are rejected before any mutation', (t) => {
  for (const relative of ['.agents', 'AGENTS.md', '.fluttercrew-install.json', '.vscode/settings.json']) {
    const p = fixture(t);
    const outside = path.join(p.root, 'outside');
    fs.mkdirSync(outside);
    p.write('outside/keep', 'untouched');
    fs.mkdirSync(path.dirname(path.join(p.root, relative)), { recursive: true });
    fs.symlinkSync(outside, path.join(p.root, relative));
    const before = snapshot(p.root);
    assert.equal(p.run('install').status, 1, relative);
    assert.deepEqual(snapshot(p.root), before, relative);
  }
  const p = fixture(t);
  p.write('AGENTS.md', 'original');
  success(p.run('install'));
  const backup = JSON.parse(p.read(manifestName)).files['AGENTS.md'].backup.path;
  fs.unlinkSync(path.join(p.root, backup));
  p.write('outside.txt', 'untouched');
  fs.symlinkSync(path.join(p.root, 'outside.txt'), path.join(p.root, backup));
  const before = snapshot(p.root);
  assert.equal(p.run('uninstall').status, 1);
  assert.deepEqual(snapshot(p.root), before);
});

test('symlink target roots and manifest traversal are rejected', (t) => {
  const p = fixture(t);
  fs.mkdirSync(path.join(p.root, 'real'));
  fs.symlinkSync(path.join(p.root, 'real'), path.join(p.root, 'alias'));
  assert.equal(p.run('install', 'alias').status, 1);
  assert.deepEqual(fs.readdirSync(path.join(p.root, 'real')), []);
  p.write(manifestName, JSON.stringify({
    version: 1, files: { '../outside': { hash: 'a'.repeat(64) } }, directories: [],
  }));
  const before = snapshot(p.root);
  assert.equal(p.run('uninstall').status, 1);
  assert.deepEqual(snapshot(p.root), before);
});

test('trusted ancestor aliases are canonicalized but symlinks inside the target remain rejected', (t) => {
  const p = fixture(t);
  fs.mkdirSync(path.join(p.root, 'parent/project'), { recursive: true });
  fs.symlinkSync(path.join(p.root, 'parent'), path.join(p.root, 'parent-alias'));
  success(p.run('install', 'parent-alias/project'));
  assert.equal(p.exists(`parent/project/${manifestName}`), true);
  success(p.run('uninstall', 'parent-alias/project'));
  p.write('parent/project/outside.txt', 'keep');
  fs.symlinkSync(path.join(p.root, 'parent/project/outside.txt'), path.join(p.root, 'parent/project/AGENTS.md'));
  const before = snapshot(p.root);
  assert.equal(p.run('install', 'parent-alias/project').status, 1);
  assert.deepEqual(snapshot(p.root), before);
});

test('public CLI supports native macOS /var ancestor alias without writes', {
  skip: process.platform !== 'darwin',
}, (t) => {
  const p = fixture(t);
  const target = '/var/empty';
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    t.skip('Native /var/empty fixture is unavailable');
    return;
  }
  const before = snapshot(target);
  const result = p.run('install', target, '--dry-run');
  success(result);
  assert.match(result.stdout, /Dry run: would install/);
  assert.match(result.stdout, /\/private\/var\/empty/);
  assert.deepEqual(snapshot(target), before);
});

test('directory/file collisions fail before writing any installer content', (t) => {
  const p = fixture(t);
  fs.mkdirSync(path.join(p.root, 'AGENTS.md'));
  p.write('AGENTS.md/custom', 'keep');
  const before = snapshot(p.root);
  assert.equal(p.run('install').status, 1);
  assert.deepEqual(snapshot(p.root), before);
});

test('doctor missing tools is actionable and does not mutate project/run state', (t) => {
  const p = fixture(t);
  p.write('pubspec.yaml', 'name: sample\ndependencies:\n  firebase_core: any\n  supabase_flutter: any\n');
  p.write('.fluttercrew/run.json', '{"status":"active"}');
  p.write('.env', 'PRIVATE_TOKEN=do-not-print-this-local-value');
  p.write('firebase.json', '{"invalid": "do-not-print-this-local-value"');
  const before = snapshot(p.root);
  const result = spawnSync(process.execPath, [cli, 'doctor'], {
    cwd: p.root, env: { ...process.env, PATH: '' }, encoding: 'utf8', timeout: 30000,
  });
  assert.equal(result.status, 1);
  for (const tool of ['node', 'flutter', 'dart']) assert.match(result.stdout, new RegExp(`${tool} unavailable`));
  assert.match(result.stdout, /PATH/);
  assert.match(result.stdout, /firebase_options.dart/);
  assert.match(result.stdout, /Supabase initialization not found/);
  assert.doesNotMatch(result.stdout + result.stderr, /do-not-print-this-local-value/);
  assert.deepEqual(snapshot(p.root), before);
});

test('doctor succeeds with available tools and minimal local configuration without writing', (t) => {
  const p = fixture(t);
  p.write('pubspec.yaml', 'name: sample\n');
  p.write('lib/main.dart', 'void main() {}');
  success(p.run('install'));
  const before = snapshot(p.root);
  const result = doctorWithAvailableTools(p);
  success(result);
  assert.match(result.stdout, /OK: flutter/);
  assert.deepEqual(snapshot(p.root), before);
});

test('doctor auto-detects auth-only Firebase and Supabase without requiring database rules/migrations', (t) => {
  const p = fixture(t);
  p.write('pubspec.yaml', 'name: sample\ndependencies:\n  firebase_core: any\n  firebase_auth: any\n  supabase_flutter: any\n');
  p.write('lib/main.dart', `
void main() {
  Firebase.initializeApp(options: explicitLocalOptions);
  Supabase.initialize(url: localUrl, anonKey: localPublicKey);
  Supabase.instance.client.auth.signInWithPassword(email: email, password: password);
}
`);
  success(p.run('install'));
  const before = snapshot(p.root);
  const result = doctorWithAvailableTools(p);
  success(result);
  assert.match(result.stdout, /Detected backend: firebase/);
  assert.match(result.stdout, /Detected backend: supabase/);
  assert.doesNotMatch(result.stdout, /firestore.rules|RLS migrations/);
  assert.deepEqual(snapshot(p.root), before);
});

test('doctor uses fixed Windows batch launcher commands without interpolating project paths', (t) => {
  const p = fixture(t);
  p.write('pubspec.yaml', 'name: sample\n');
  p.write('lib/main.dart', 'void main() {}');
  success(p.run('install'));
  const before = snapshot(p.root);
  const result = spawnSync(process.execPath, ['-e', `
Object.defineProperty(process, 'platform', { value: 'win32' });
require('node:child_process').spawnSync = (tool, args) => {
  console.log(JSON.stringify([tool, ...args]));
  return { status: 0, stdout: 'v22.0.0', stderr: '' };
};
require(${JSON.stringify(cli)}).doctor('.');
`], { cwd: p.root, encoding: 'utf8' });
  success(result);
  assert.match(result.stdout, /\["node","--version"\]/);
  assert.match(result.stdout, /\["cmd.exe","\/d","\/s","\/c","flutter.bat --version"\]/);
  assert.match(result.stdout, /\["cmd.exe","\/d","\/s","\/c","dart.bat --version"\]/);
  assert.deepEqual(snapshot(p.root), before);
});

test('noninteractive init aliases and empty-directory default fail promptly with next steps', (t) => {
  const p = fixture(t);
  for (const args of [[], ['init'], ['create'], ['new']]) {
    const result = p.run(...args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /interactive terminal/);
    assert.match(result.stderr, /flutter create/);
    assert.match(result.stderr, /install <directory>/);
  }
  assert.deepEqual(snapshot(p.root), {});
});

test('init preserves existing rules/env while adding Firebase packages even if rules already exist', (t) => {
  for (const backend of ['1', '2']) {
    const p = fixture(t);
    p.write('existing/pubspec.yaml', 'name: existing');
    p.write('existing/firestore.rules', 'reviewed rules');
    p.write('existing/.env.example', 'existing config template');
    p.write('init-preload.js', `
const fs = require('node:fs');
Object.defineProperty(process.stdin, 'isTTY', { value: true });
Object.defineProperty(process.stdout, 'isTTY', { value: true });
const answers = ['existing', 'y', '1', '${backend}', '${backend}'];
require('node:readline').createInterface = () => ({
  once() {}, removeListener() {}, close() {},
  question(query, callback) { callback(answers.shift()); }
});
require('node:child_process').execFileSync = (tool, args) => {
  fs.appendFileSync('flutter-commands.log', JSON.stringify([tool, ...args]) + '\\n');
};
`);
    const result = spawnSync(process.execPath, ['--require', './init-preload.js', cli, 'init'], {
      cwd: p.root, encoding: 'utf8', timeout: 30000,
    });
    success(result);
    assert.equal(p.read('existing/firestore.rules'), 'reviewed rules');
    assert.equal(p.read('existing/.env.example'), 'existing config template');
    if (backend === '2') assert.match(p.read('flutter-commands.log'), /firebase_core.*firebase_auth.*cloud_firestore/);
    if (backend === '2') assert.doesNotMatch(p.read('flutter-commands.log'), /mocktail|bloc_test/);
    assert.match(result.stdout, /optional requirements document/);
  }
});

test('runtime registry routing handles status/resume/watch help without installation', (t) => {
  const p = fixture(t);
  for (const name of ['status', 'resume']) {
    const result = p.run(name);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No run/);
  }
  success(p.run('watch', '--help'));
  assert.equal(p.exists(manifestName), false);
  assert.equal(p.exists('.agents'), false);
});
