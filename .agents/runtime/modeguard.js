'use strict';

const { spawnSync } = require('node:child_process');
const { MODE_LIMITS, MODE_SENSITIVE } = require('./constants');

/**
 * Paths with uncommitted changes (project-relative, POSIX), or null when the
 * project is not inside a git work tree (guard is then skipped, never guessed).
 */
function gitDirty(root) {
  const run = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', shell: false });
  const inside = run(['rev-parse', '--is-inside-work-tree']);
  if (inside.error || inside.status !== 0 || inside.stdout.trim() !== 'true') return null;
  const prefix = run(['rev-parse', '--show-prefix']).stdout.trim();
  const status = run(['status', '--porcelain', '-z', '--untracked-files=all', '--', '.']);
  if (status.error || status.status !== 0) return null;
  const parts = status.stdout.split('\0').filter(Boolean);
  const files = new Set();
  for (let i = 0; i < parts.length; i++) {
    const code = parts[i].slice(0, 2);
    let file = parts[i].slice(3);
    if (/[RC]/.test(code)) i++; // renames/copies list the origin path next
    if (prefix && file.startsWith(prefix)) file = file.slice(prefix.length);
    files.add(file.replace(/\\/g, '/'));
  }
  return files;
}

/**
 * Anti-gaming guard for the declared mode. A `fix` run must stay small and must
 * not touch dependencies or backend configuration; otherwise the spec must be
 * revised to mode "feature"/"app". Skipped without git or an approval baseline.
 */
function modeIssues(root, mode, baseline) {
  const limits = MODE_LIMITS[mode];
  if (!limits || !Array.isArray(baseline)) return [];
  const dirty = gitDirty(root);
  if (!dirty) return [];
  const added = [...dirty].filter((file) => !baseline.includes(file));
  const issues = [];
  const sensitive = added.filter((file) => MODE_SENSITIVE.some((item) =>
    item.endsWith('/') ? file.startsWith(item) : file === item));
  if (sensitive.length) {
    issues.push(`Mode "${mode}" must not change dependencies/backend config (${sensitive.slice(0, 3).join(', ')}). Revise the spec to mode "feature".`);
  }
  const source = added.filter((file) => /^(lib|test|integration_test)\/.+\.dart$/.test(file));
  if (limits.maxSourceFiles && source.length > limits.maxSourceFiles) {
    issues.push(`Mode "${mode}" changed ${source.length} Dart files (limit ${limits.maxSourceFiles}). Revise the spec to mode "feature".`);
  }
  return issues;
}

module.exports = { gitDirty, modeIssues };
