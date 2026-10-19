'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { PATHS, LIMITS } = require('./constants');
const { isHeadless } = require('./platform');

const isAlive = (pid) => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};

/**
 * Spawn the detached dashboard watcher unless one is already running.
 * `entry` is the CLI script that implements the `watch` command.
 */
function ensureWatcher(root, entry) {
  try {
    if (isHeadless()) return;
    const pidFile = path.join(root, PATHS.watcherPid);
    if (fs.existsSync(pidFile) && isAlive(Number(fs.readFileSync(pidFile, 'utf8')))) return;
    const child = spawn(process.execPath, [entry, 'watch'], { cwd: root, detached: true, stdio: 'ignore' });
    child.unref();
    fs.mkdirSync(path.dirname(pidFile), { recursive: true });
    fs.writeFileSync(pidFile, String(child.pid));
  } catch { /* the dashboard is best-effort */ }
}

/**
 * Long-running loop: re-render the dashboard every few seconds so phases advance
 * while the agent is editing files and running no runtime command.
 * Continues after DONE to detect stale evidence. Exits when the run disappears
 * or after LIMITS.watchMaxAgeMs.
 * @param {() => ({status?: string}|undefined)} render re-renders and returns the report
 */
function watch(root, render, { intervalMs = LIMITS.watchIntervalMs } = {}) {
  const pidFile = path.join(root, PATHS.watcherPid);
  const runFile = path.join(root, PATHS.runFile);
  const startedAt = Date.now();

  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  fs.writeFileSync(pidFile, String(process.pid));
  const stop = () => {
    try { fs.rmSync(pidFile, { force: true }); } catch { /* ignore */ }
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  const tick = () => {
    if (!fs.existsSync(runFile) || Date.now() - startedAt > LIMITS.watchMaxAgeMs) return stop();
    try { render(); } catch (error) { console.error(`Dashboard refresh failed: ${error.message}`); }
  };
  tick();
  setInterval(tick, intervalMs);
}

module.exports = { ensureWatcher, watch };
