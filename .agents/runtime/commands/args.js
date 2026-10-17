'use strict';

/** Split CLI args into positionals and `--flags` so flags may appear anywhere. */
function parseArgs(args) {
  const positional = [];
  const flags = new Set();
  for (const arg of args) {
    if (arg.startsWith('--')) flags.add(arg);
    else positional.push(arg);
  }
  return { positional, flags };
}

module.exports = { parseArgs };
