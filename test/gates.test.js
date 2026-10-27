'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

function gates(t, platform) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluttercrew-gates-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const calls = [];
  const module = { exports: {} };
  const file = path.resolve(__dirname, '../.agents/runtime/gates.js');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    module,
    __dirname: path.dirname(file),
    __filename: file,
    process: { platform },
    require(name) {
      if (name === 'node:child_process') {
        return {
          spawnSync(executable, args, options) {
            calls.push({ executable, args, options });
            return { status: 0, stdout: 'Gate executor fixture.\n' };
          }
        };
      }
      if (name.startsWith('./')) return require(path.join(__dirname, '../.agents/runtime', name));
      return require(name);
    }
  }, { filename: file });
  return { root, calls, ...module.exports };
}

test('Windows SDK gates support bat wrappers while other executables remain shell-free', (t) => {
  const p = gates(t, 'win32');
  for (const gate of p.gatePlan(p.root)) {
    assert.equal(p.commandCheck(p.root, gate.name, gate.executable, gate.args).passed, true);
  }
  assert.equal(p.calls.length, 3);
  assert.ok(p.calls.every(({ options }) => options.shell === true));
  p.commandCheck(p.root, 'node', process.execPath, ['--version']);
  assert.equal(p.calls[3].options.shell, false);
});

test('Windows SDK gate arguments reject shell interpolation before spawning', (t) => {
  const p = gates(t, 'win32');
  for (const arg of ['lib & echo unexpected', '%PATH%', '$(echo unexpected)', '../a b']) {
    assert.throws(() => p.commandCheck(p.root, 'format', 'dart', ['format', arg]),
      /Windows SDK gate arguments/);
  }
  assert.equal(p.calls.length, 0);
});

test('Unix SDK gates never request a shell', (t) => {
  const p = gates(t, 'darwin');
  for (const gate of p.gatePlan(p.root)) p.commandCheck(p.root, gate.name, gate.executable, gate.args);
  assert.ok(p.calls.every(({ options }) => options.shell === false));
});
