'use strict';

const { spawnSync } = require('node:child_process');

/** True in CI, tests or when the user opted out: never open browsers or spawn daemons. */
const isHeadless = () => Boolean(process.env.CI || process.env.HEADLESS || process.env.NODE_ENV === 'test');

/** Best-effort: open a file in the default browser; failures are never fatal. */
function openBrowser(file) {
  try {
    if (isHeadless()) return;
    const opener = { darwin: 'open', win32: 'start' }[process.platform] || 'xdg-open';
    spawnSync(opener, [file], { shell: true, stdio: 'ignore' });
  } catch { /* the dashboard is a convenience, not a gate */ }
}

module.exports = { isHeadless, openBrowser };
