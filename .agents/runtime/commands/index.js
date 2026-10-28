'use strict';

const { start, spec, approve, archive } = require('./lifecycle');
const { trace, accept } = require('./evidence');
const { verify, finish } = require('./verification');
const { status, next, dashboard, watch } = require('./views');
const { task } = require('./tasks');
const { profile, doctor } = require('./project');
const { feature } = require('./features');

/**
 * Command registry: one entry per CLI command. `usage` feeds the help text and
 * `hidden` commands are internal. To add a command, add a handler and an entry.
 * Handlers receive (ctx, args) where ctx = { root, execute, store, interactive, entry }.
 */
const COMMANDS = Object.freeze({
  start: { usage: 'start <requirements.md> <backend> [--archive]', run: start },
  spec: { usage: 'spec <spec.json> [change.md]', run: spec },
  approve: { usage: 'approve [notes]', run: approve },
  trace: { usage: 'trace <REQ-ID> <trace.json> | trace --auto <REQ-ID> [--impl=a,b] [--tests=a,b]', run: trace },
  status: { usage: 'status [--summary]', run: status },
  next: { usage: 'next [--json]', run: next },
  resume: { usage: 'resume', run: status },
  task: { usage: 'task <REQ-ID> <implementation|testing> <pending|in_progress|done|blocked> <notes> | task --all <phase> <status> <notes>', run: task },
  verify: { usage: 'verify', run: verify },
  accept: { usage: 'accept <criterion> <evidence-file> | accept --draft <criterion>', run: accept },
  feature: { usage: 'feature sync', run: feature },
  finish: { usage: 'finish', run: finish },
  profile: { usage: 'profile [--json]', run: profile },
  doctor: { usage: 'doctor [--json]', run: doctor },
  dashboard: { usage: 'dashboard [--open|--no-open]', run: dashboard },
  archive: { usage: 'archive [label]', run: archive },
  watch: { usage: 'watch', run: watch, hidden: true }
});

const COMMAND_NAMES = Object.freeze(Object.keys(COMMANDS));
const usage = () => `Commands: ${Object.values(COMMANDS).filter((c) => !c.hidden).map((c) => c.usage).join(', ')}`;

module.exports = { COMMANDS, COMMAND_NAMES, usage };
