'use strict';

// Gate: generated Dart code must be up to date. Runs build_runner and fails when
// any generated file changed, i.e. the committed output was stale.
// Skipped (passes) when the project does not use build_runner.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const GENERATED = /\.(?:g|freezed|gr|config)\.dart$/;

function generatedFiles(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) generatedFiles(full, out);
    else if (GENERATED.test(entry.name)) out.push(full);
  }
  return out;
}

function fingerprint(root) {
  const hash = crypto.createHash('sha256');
  for (const file of generatedFiles(path.join(root, 'lib')).sort()) {
    hash.update(path.relative(root, file)).update(fs.readFileSync(file));
  }
  return hash.digest('hex');
}

function main(root) {
  let pubspec = '';
  try { pubspec = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8'); } catch { /* handled below */ }
  if (!/^\s*build_runner\s*:/m.test(pubspec)) {
    console.log('SKIPPED: build_runner is not a dependency of this project.');
    return 0;
  }
  const before = fingerprint(root);
  const result = spawnSync('dart', ['run', 'build_runner', 'build', '--delete-conflicting-outputs'],
    { cwd: root, encoding: 'utf8', shell: false });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.error || result.status !== 0) {
    console.error('FAILED: build_runner did not complete.');
    return 1;
  }
  if (fingerprint(root) !== before) {
    console.error('FAILED: generated code was out of date and has been regenerated. Review and re-run verify.');
    return 1;
  }
  console.log('PASSED: generated code is up to date.');
  return 0;
}

if (require.main === module) process.exitCode = main(process.cwd());

module.exports = { fingerprint, generatedFiles };
