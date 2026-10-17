#!/usr/bin/env node
'use strict';

/**
 * FlutterCrew runtime entry point: portable local quality gates.
 * The IDE supplies the AI/tool execution loop; this process owns run state,
 * evidence integrity and the live dashboard.
 *
 *   constants -> fsutil -> state/preflight/report -> commands/* -> crew (this file)
 *
 * See README.md in this directory for the module map.
 */
const { CRITERIA, LIMITS } = require('./constants');
const { createStore } = require('./state');
const { commandCheck } = require('./gates');
const { preflight } = require('./preflight');
const { snapshot } = require('./report');
const { COMMANDS, usage } = require('./commands');

/**
 * Execute one runtime command.
 * @param {string[]} argv command followed by its arguments
 * @param {string} root project root
 * @param {Function} execute gate executor (inject a double in tests)
 */
function run(argv = process.argv.slice(2), root = process.cwd(), execute = commandCheck) {
  if (Number(process.versions.node.split('.')[0]) < LIMITS.minNodeMajor) {
    throw new Error(`Node.js ${LIMITS.minNodeMajor}+ is required.`);
  }
  const [name, ...args] = argv;
  const command = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : null;
  if (!command) throw new Error(usage());
  const ctx = { root, execute, store: createStore(root), interactive: execute === commandCheck, entry: __filename };
  return command.run(ctx, args);
}

if (require.main === module) {
  try { run(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { run, preflight, snapshot, criteria: CRITERIA, commandCheck };