#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--offline')) {
  throw new Error('Usage: node scripts/flutter-smoke.js [--offline]');
}
const repository = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fluttercrew-smoke-'));
const project = path.join(temporary, 'smoke_app');

function execute(executable, args, cwd) {
  console.log(`> ${executable} ${args.join(' ')}`);
  const result = spawnSync(executable, args, {
    cwd, encoding: 'utf8', timeout: 600000, maxBuffer: 16 * 1024 * 1024
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${executable} failed with exit code ${result.status}`);
}

function write(name, value) {
  const file = path.join(project, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
}

try {
  execute('flutter', ['create', '--platforms=web', '--project-name=smoke_app',
    ...(args.includes('--offline') ? ['--offline'] : []), project], temporary);
  const mainBefore = fs.readFileSync(path.join(project, 'lib/main.dart'), 'utf8');
  const testBefore = fs.readFileSync(path.join(project, 'test/widget_test.dart'), 'utf8');
  execute(process.execPath, [path.join(repository, 'bin/cli.js'), project], temporary);
  assert.equal(fs.readFileSync(path.join(project, 'lib/main.dart'), 'utf8'), mainBefore);
  assert.equal(fs.readFileSync(path.join(project, 'test/widget_test.dart'), 'utf8'), testBefore);
  const runtime = path.join(project, '.agents/runtime/crew.js');
  const invoke = (...args) => execute(process.execPath, [runtime, ...args], project);

  // This is a disposable harness run, never a delivery approval for a user's app.
  write('docs/fluttercrew/request.md',
    'Smoke fixture: the generated Flutter counter increments when its add button is tapped.\n');
  write('docs/fluttercrew/spec.json', {
    schemaVersion: 1,
    requirements: [{
      id: 'REQ-001',
      description: 'The generated counter increments when its add button is tapped.',
      source: 'docs/fluttercrew/request.md:1',
      acceptanceCriteria: ['The generated widget test passes through the installed real Flutter gates.'],
      verification: 'automated'
    }]
  });
  execute('dart', ['format', 'lib', 'test'], project);
  invoke('start', 'docs/fluttercrew/request.md', 'none', '--no-open', '--no-watch');
  invoke('spec', 'docs/fluttercrew/spec.json');
  invoke('approve', 'Disposable CI harness scope only, not product approval');
  invoke('verify');

  const state = JSON.parse(fs.readFileSync(path.join(project, '.fluttercrew/run.json'), 'utf8'));
  assert.equal(state.verification.passed, true);
  assert.deepEqual(state.verification.checks.map(({ name, passed }) => [name, passed]),
    [['format', true], ['analyze', true], ['tests', true]]);
  for (const check of state.verification.checks) {
    assert.ok(fs.statSync(path.join(project, check.log)).size > 0);
  }
  assert.notEqual(state.status, 'done', 'Passing mechanical gates must not imply completed delivery.');

  const { run } = require(runtime);
  write('lib/main.dart', `${fs.readFileSync(path.join(project, 'lib/main.dart'), 'utf8')}\n// Smoke invalidation probe.\n`);
  const originalLog = console.log;
  let report;
  try {
    console.log = () => {};
    report = run(['status'], project);
  } finally {
    console.log = originalLog;
  }
  assert.equal(report.verificationStatus.status, 'stale');
  write('lib/main.dart', mainBefore);
  write('test/widget_test.dart', testBefore);
  execute(process.execPath, [path.join(repository, 'bin/cli.js'), 'uninstall', project], temporary);
  assert.equal(fs.existsSync(runtime), false);
  assert.equal(fs.readFileSync(path.join(project, 'lib/main.dart'), 'utf8'), mainBefore);
  assert.equal(fs.readFileSync(path.join(project, 'test/widget_test.dart'), 'utf8'), testBefore);
  console.log('PASS: real Flutter gates, stale-input detection and uninstall preserve the generated app.');
} catch (error) {
  for (const name of ['format', 'analyze', 'tests']) {
    const log = path.join(project, '.fluttercrew/logs', `${name}.txt`);
    if (fs.existsSync(log)) {
      process.stderr.write(`\n--- ${name} ---\n${fs.readFileSync(log, 'utf8')}\n`);
    }
  }
  throw error;
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
