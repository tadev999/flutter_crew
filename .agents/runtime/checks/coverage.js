'use strict';

// Gate: line coverage must reach a minimum. Usage: node coverage.js <lcov> <minPercent>
// Generated files (*.g.dart, *.freezed.dart, ...) are excluded from the percentage.
const fs = require('node:fs');
const path = require('node:path');

const GENERATED = /\.(?:g|freezed|gr|config|mocks)\.dart$/;

/** @returns {{found:number, hit:number, percent:number}} */
function coveragePercent(lcov) {
  let found = 0;
  let hit = 0;
  let skip = false;
  for (const line of lcov.split(/\r?\n/)) {
    if (line.startsWith('SF:')) skip = GENERATED.test(line.slice(3).trim());
    else if (!skip && line.startsWith('LF:')) found += Number(line.slice(3)) || 0;
    else if (!skip && line.startsWith('LH:')) hit += Number(line.slice(3)) || 0;
  }
  return { found, hit, percent: found ? (hit / found) * 100 : 0 };
}

function main(argv) {
  const [file = 'coverage/lcov.info', min = '80'] = argv;
  const target = path.resolve(process.cwd(), file);
  if (!fs.existsSync(target)) {
    console.error(`Coverage report not found: ${file}. The tests gate must run with --coverage.`);
    return 1;
  }
  const { found, hit, percent } = coveragePercent(fs.readFileSync(target, 'utf8'));
  const text = `Line coverage ${percent.toFixed(1)}% (${hit}/${found}); required ${Number(min)}%.`;
  if (!found || percent < Number(min)) {
    console.error(`FAILED: ${text}`);
    return 1;
  }
  console.log(`PASSED: ${text}`);
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { coveragePercent };
