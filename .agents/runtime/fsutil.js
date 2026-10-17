'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { IGNORED_DIRS } = require('./constants');

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

/** Read a UTF-8 file, returning '' when it does not exist. */
const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

const hashFile = (file) => hash(fs.readFileSync(file));

/** Recursively list files below `target` (sorted, symlink- and cache-safe). */
function listFiles(target) {
  if (!fs.existsSync(target)) return [];
  if (fs.lstatSync(target).isSymbolicLink()) return [];
  if (!fs.statSync(target).isDirectory()) return [target];
  return fs.readdirSync(target).sort().flatMap((name) => (
    IGNORED_DIRS.has(name) ? [] : listFiles(path.join(target, name))
  ));
}

/**
 * Resolve a project-relative path to a real file inside `root`.
 * Rejects absolute paths, traversal and symlink escapes.
 */
function resolveProjectFile(root, relative) {
  if (!relative || path.isAbsolute(relative)) throw new Error('Use a project-relative file path.');
  const actual = fs.realpathSync(path.resolve(root, relative));
  const prefix = fs.realpathSync(root) + path.sep;
  if (!actual.startsWith(prefix) || !fs.statSync(actual).isFile()) {
    throw new Error('Evidence/requirements must be a file inside the project.');
  }
  return actual;
}

/** Write JSON atomically so a crash never leaves a half-written run state. */
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(`${file}.tmp`, file);
}

/** Move a file or directory into `destination`, creating parents. No-op if missing. */
function moveInto(source, destination) {
  if (!fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
  fs.rmSync(source, { recursive: true, force: true });
  return true;
}

module.exports = { hash, hashFile, read, listFiles, resolveProjectFile, writeJsonAtomic, moveInto };
