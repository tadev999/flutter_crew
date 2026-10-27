'use strict';

/**
 * Split CLI args into positionals, `--flags` and `--key=value` options so they
 * may appear anywhere. `flags` keeps every `--` token (including `--key=value`)
 * for backward compatibility; `options` holds the parsed key/value pairs.
 */
function parseArgs(args) {
  const positional = [];
  const flags = new Set();
  const options = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      flags.add(arg);
      const eq = arg.indexOf('=');
      if (eq > 2) options[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else positional.push(arg);
  }
  return { positional, flags, options };
}

/** Split a comma-separated option into trimmed non-empty items. */
const listOption = (value) => (value || '').split(',').map((item) => item.trim()).filter(Boolean);

module.exports = { parseArgs, listOption };
