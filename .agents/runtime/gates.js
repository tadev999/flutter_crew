'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PATHS, LIMITS } = require('./constants');

/**
 * Default gate executor: run one command, store its full output as a log file
 * and report pass/fail. Injected into commands so tests can swap in a double.
 */
function commandCheck(root, name, executable, args) {
  const windowsSdkTool = process.platform === 'win32' && ['flutter', 'dart'].includes(executable);
  if (windowsSdkTool && args.some((arg) => !/^[a-zA-Z0-9_./=-]+$/.test(arg))) {
    throw new Error('Windows SDK gate arguments must be fixed command options or project-relative source directories.');
  }
  const result = spawnSync(executable, args, {
    cwd: root, encoding: 'utf8', timeout: LIMITS.commandTimeoutMs,
    // Flutter distributes .bat SDK wrappers on Windows; gatePlan supplies fixed arguments.
    maxBuffer: LIMITS.commandMaxBuffer, shell: windowsSdkTool
  });
  const log = `${PATHS.logsDir}/${name}.txt`;
  fs.mkdirSync(path.join(root, PATHS.logsDir), { recursive: true });
  fs.writeFileSync(path.join(root, log), [executable, ...args].join(' ') + '\n' +
    (result.stdout || '') + (result.stderr || '') + (result.error?.message || ''));
  return { name, passed: !result.error && result.status === 0, log };
}

/** The concrete commands behind each GATES entry, keyed by gate name. */
function gatePlan(root) {
  const sourceDirs = ['test', 'integration_test'].filter((dir) => fs.existsSync(path.join(root, dir)));
  return [
    { name: 'format', executable: 'dart', args: ['format', '--output=none', '--set-exit-if-changed', 'lib', ...sourceDirs] },
    { name: 'analyze', executable: 'flutter', args: ['analyze', '--fatal-infos'] },
    { name: 'tests', executable: 'flutter', args: ['test'] }
  ];
}

module.exports = { commandCheck, gatePlan };
