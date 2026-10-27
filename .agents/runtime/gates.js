'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { GATES, OPTIONAL_GATES, PATHS, LIMITS } = require('./constants');
const { loadConfig } = require('./config');

/**
 * Default gate executor: run one command, store its full output as a log file
 * and report pass/fail. Injected into commands so tests can swap in a double.
 */
function commandCheck(root, name, executable, args) {
  const windowsSdkTool = process.platform === 'win32' && ['flutter', 'dart'].includes(executable);
  if (windowsSdkTool && args.some((arg) => !/^[a-zA-Z0-9_./=-]+$/.test(arg))) {
    throw new Error('Windows SDK gate arguments must be fixed command options or project-relative source directories.');
  }
  const config = loadConfig(root);
  const timeoutMs = config?.gates?.timeoutMs ?? LIMITS.commandTimeoutMs;
  const result = spawnSync(executable, args, {
    cwd: root, encoding: 'utf8', timeout: timeoutMs,
    // Flutter distributes .bat SDK wrappers on Windows; gatePlan supplies fixed arguments.
    maxBuffer: LIMITS.commandMaxBuffer, shell: windowsSdkTool
  });
  const log = `${PATHS.logsDir}/${name}.txt`;
  fs.mkdirSync(path.join(root, PATHS.logsDir), { recursive: true });
  fs.writeFileSync(path.join(root, log), [executable, ...args].join(' ') + '\n' +
    (result.stdout || '') + (result.stderr || '') + (result.error?.message || ''));
  return { name, passed: !result.error && result.status === 0, log };
}

/** Gate definitions (name/label/sub) active for this project, in execution order. */
function activeGates(root) {
  const { gates } = loadConfig(root);
  const [format, analyze, tests] = GATES;
  return [format, ...(gates.codegen ? [OPTIONAL_GATES.codegen] : []), analyze, tests,
    ...(gates.coverage ? [OPTIONAL_GATES.coverage] : [])];
}

const check = (file) => path.join(__dirname, 'checks', file);

/** The concrete commands behind each active gate, keyed by gate name. */
function gatePlan(root) {
  const { gates } = loadConfig(root);
  const sourceDirs = ['test', 'integration_test'].filter((dir) => fs.existsSync(path.join(root, dir)));
  const plan = {
    format: { name: 'format', executable: 'dart', args: ['format', '--output=none', '--set-exit-if-changed', 'lib', ...sourceDirs] },
    codegen: { name: 'codegen', executable: process.execPath, args: [check('codegen.js')] },
    analyze: { name: 'analyze', executable: 'flutter', args: ['analyze', ...(gates.analyzeFatalInfos ? ['--fatal-infos'] : [])] },
    tests: { name: 'tests', executable: 'flutter', args: ['test', ...(gates.coverage ? ['--coverage'] : [])] },
    coverage: { name: 'coverage', executable: process.execPath, args: [check('coverage.js'), 'coverage/lcov.info', String(gates.minCoverage)] }
  };
  return activeGates(root).map(({ name }) => plan[name]);
}

module.exports = { commandCheck, gatePlan, activeGates };
