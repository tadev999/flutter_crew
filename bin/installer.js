'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const INSTALLER_DIR = '.fluttercrew-installer';
const MANIFEST = `${INSTALLER_DIR}/manifest.json`;
const LEGACY_MANIFEST = '.fluttercrew-install.json';
const backupPath = (relative) => `${INSTALLER_DIR}/backups/${relative}`;
const ITEMS = ['.vscode', '.github', '.agents', '.cursorrules', 'AGENTS.md', 'GEMINI.md', 'CLAUDE.md'];
// Team-owned project knowledge and run evidence: never written or removed by install/uninstall.
const PRESERVED = ['docs/features/', 'docs/fluttercrew/', '.fluttercrew/', '.agents/local/'];
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const stat = (file) => {
  try { return fs.lstatSync(file); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

function canonicalRoot(root) {
  const absolute = path.resolve(root);
  if (stat(absolute)?.isSymbolicLink()) throw new Error(`Refusing symlink target: ${absolute}`);
  let existing = absolute;
  const missing = [];
  while (!stat(existing)) {
    missing.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  // Canonicalize trusted target ancestors (notably macOS /var -> /private/var).
  // Relative installation paths below this boundary must never follow links.
  return path.join(fs.realpathSync(existing), ...missing);
}

function safePath(root, relative = '') {
  if (relative && (path.isAbsolute(relative) || relative.split(/[\\/]/).some((p) => !p || p === '.' || p === '..'))) {
    throw new Error(`Unsafe installation path: ${relative}`);
  }
  let current = canonicalRoot(root);
  const full = path.resolve(current, relative);
  for (const part of relative.split('/').filter(Boolean)) {
    current = path.join(current, part);
    if (stat(current)?.isSymbolicLink()) throw new Error(`Refusing symlink: ${current}`);
  }
  return full;
}

function regular(root, relative) {
  const file = safePath(root, relative);
  const info = stat(file);
  if (info && !info.isFile()) throw new Error(`Expected a regular file: ${file}`);
  return info;
}

function readManifest(root) {
  for (const relative of [INSTALLER_DIR, `${INSTALLER_DIR}/backups`]) {
    const info = stat(safePath(root, relative));
    if (info && !info.isDirectory()) throw new Error(`Expected directory: ${relative}`);
  }
  const current = regular(root, MANIFEST);
  const legacy = regular(root, LEGACY_MANIFEST);
  if (current && legacy) throw new Error('Both installer manifests exist; preserve recovery files and resolve the conflict manually.');
  if (!current && !legacy) return { version: 2, files: {}, directories: [] };
  const value = JSON.parse(fs.readFileSync(path.join(root, current ? MANIFEST : LEGACY_MANIFEST), 'utf8'));
  if (value.version !== (current ? 2 : 1) || !value.files || typeof value.files !== 'object' ||
      Array.isArray(value.files) || !Array.isArray(value.directories)) {
    throw new Error('Unsupported installation manifest; preserve it and recover manually.');
  }
  for (const [relative, entry] of Object.entries(value.files)) {
    if (!ITEMS.some((item) => relative === item || relative.startsWith(`${item}/`)) && relative !== '.gitignore') {
      throw new Error(`Invalid manifest ownership: ${relative}`);
    }
    regular(root, relative);
    if (!entry || !/^[a-f0-9]{64}$/.test(entry.hash)) throw new Error(`Invalid manifest entry: ${relative}`);
    if (entry.backup) {
      if (typeof entry.backup.path !== 'string' ||
          (current ? entry.backup.path !== backupPath(relative) :
            (!entry.backup.path.startsWith(`${relative}.fluttercrew-`) || !entry.backup.path.endsWith('.bak'))) ||
          !/^[a-f0-9]{64}$/.test(entry.backup.hash)) {
        throw new Error(`Invalid backup entry: ${relative}`);
      }
      regular(root, entry.backup.path);
    }
  }
  for (const directory of value.directories) {
    if (typeof directory !== 'string' || !ITEMS.some((item) => directory === item || directory.startsWith(`${item}/`))) {
      throw new Error('Invalid manifest directory');
    }
    const info = stat(safePath(root, directory));
    if (info && !info.isDirectory()) throw new Error(`Expected directory: ${directory}`);
  }
  return value;
}

function sourceFiles(source) {
  const files = [];
  function visit(relative) {
    if (relative === '.github/workflows/ci.yml' || relative === '.agents/local' ||
        /\.fluttercrew-.*\.bak$/.test(relative)) return;
    const file = safePath(source, relative);
    const info = stat(file);
    if (!info) return;
    if (info.isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) visit(`${relative}/${name}`);
    } else if (info.isFile()) files.push(relative);
    else throw new Error(`Unsupported installer source: ${file}`);
  }
  ITEMS.forEach(visit);
  return files;
}

function saveManifest(root, manifest) {
  // The manifest contains ownership and backup locations, never active run state.
  regular(root, MANIFEST);
  fs.mkdirSync(safePath(root, INSTALLER_DIR), { recursive: true, mode: 0o700 });
  const pending = path.join(root, `${MANIFEST}.${crypto.randomUUID()}.pending`);
  try {
    fs.writeFileSync(pending, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    fs.renameSync(pending, path.join(root, MANIFEST));
  } finally {
    fs.rmSync(pending, { force: true });
  }
}

function prepareMigration(root, manifest) {
  if (manifest.version !== 1) return () => {};
  const moves = [];
  for (const [relative, entry] of Object.entries(manifest.files)) {
    if (!entry.backup) continue;
    const from = entry.backup.path;
    const to = backupPath(relative);
    if (!regular(root, from) || hash(fs.readFileSync(path.join(root, from))) !== entry.backup.hash) {
      throw new Error(`Cannot migrate: backup missing or modified (${from}). No recovery files were changed.`);
    }
    if (stat(safePath(root, to))) throw new Error(`Cannot migrate: backup destination already exists (${to}).`);
    moves.push({ from, to, backup: entry.backup });
  }
  for (const { to, backup } of moves) backup.path = to;
  manifest.version = 2;
  const migrated = JSON.parse(JSON.stringify(manifest));
  const migrate = (dryRun) => {
    console.log(`${dryRun ? 'Would migrate' : 'Migrating'} legacy installer metadata and ${moves.length} backup(s) into ${INSTALLER_DIR}/.`);
    if (dryRun) return;
    for (const { from, to, backup } of moves) {
      fs.mkdirSync(path.dirname(safePath(root, to)), { recursive: true, mode: 0o700 });
      fs.copyFileSync(path.join(root, from), path.join(root, to), fs.constants.COPYFILE_EXCL);
      fs.chmodSync(path.join(root, to), backup.mode ?? 0o600);
    }
    saveManifest(root, migrated);
    fs.unlinkSync(path.join(root, LEGACY_MANIFEST));
    for (const { from } of moves) fs.unlinkSync(path.join(root, from));
  };
  migrate.sources = new Map(moves.map(({ from, to }) => [to, from]));
  return migrate;
}

function pruneRecoveryDirectories(root) {
  function prune(relative) {
    const full = safePath(root, relative);
    if (!stat(full)?.isDirectory()) return;
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      if (entry.isDirectory()) prune(`${relative}/${entry.name}`);
    }
    if (!fs.readdirSync(full).length) fs.rmdirSync(full);
  }
  prune(INSTALLER_DIR);
}

function install(source, target, { dryRun = false } = {}) {
  const root = canonicalRoot(target);
  safePath(root);
  if (root === canonicalRoot(source)) {
    console.log('FlutterCrew source workspace detected; installation not needed.');
    return;
  }
  if (stat(root) && !stat(root).isDirectory()) throw new Error(`Expected directory: ${root}`);
  const manifest = readManifest(root);
  const migrate = prepareMigration(root, manifest);
  const writes = [];
  const contents = sourceFiles(source).map((relative) => [relative, fs.readFileSync(path.join(source, relative))]);
  const ignoreInfo = regular(root, '.gitignore');
  const originalIgnore = ignoreInfo ? fs.readFileSync(path.join(root, '.gitignore'), 'utf8') : '';
  const missing = ['.fluttercrew/', `${INSTALLER_DIR}/`, LEGACY_MANIFEST, '*.fluttercrew-*.bak']
    .filter((line) => !originalIgnore.split(/\r?\n/).includes(line));
  if (missing.length && manifest.files['.gitignore'] &&
      (!ignoreInfo || hash(Buffer.from(originalIgnore)) !== manifest.files['.gitignore'].hash)) {
    throw new Error(`Locally modified .gitignore is missing privacy rules: ${missing.join(', ')}. ` +
      'Add these lines manually, then retry install. No installer files or backups were written.');
  }
  if (missing.length) contents.push(['.gitignore', Buffer.from(originalIgnore +
    (originalIgnore && !originalIgnore.endsWith('\n') ? '\n' : '') +
    '\n# FlutterCrew local evidence and installer ownership\n' + missing.join('\n') + '\n')]);

  for (const [relative, data] of contents) {
    const info = regular(root, relative);
    const current = info ? fs.readFileSync(path.join(root, relative)) : null;
    const owned = manifest.files[relative];
    if (relative === '.gitignore' && owned && (!current || hash(current) !== owned.hash)) {
      console.log('Preserved locally changed .gitignore; ownership retained for recovery.');
      continue;
    }
    if (current && current.equals(data)) {
      if (owned) manifest.files[relative] = { ...owned, hash: hash(data) };
      continue;
    }
    if (owned && current && hash(current) !== owned.hash) {
      console.log(`Replacing locally modified FlutterCrew file: ${relative}`);
    }
    let backup = owned?.backup || null;
    if (!owned && current) {
      backup = {
        path: backupPath(relative),
        hash: hash(current),
        mode: info.mode & 0o777,
      };
      if (stat(safePath(root, backup.path))) throw new Error(`Backup already exists: ${backup.path}`);
    }
    manifest.files[relative] = { hash: hash(data), backup };
    writes.push({ relative, data, current, backup: !owned ? backup : null });
    let directory = path.posix.dirname(relative);
    while (directory !== '.') {
      const existing = stat(safePath(root, directory));
      if (existing && !existing.isDirectory()) throw new Error(`Expected directory: ${directory}`);
      if (!existing && !manifest.directories.includes(directory)) manifest.directories.push(directory);
      directory = path.posix.dirname(directory);
    }
  }

  // Previously shipped files absent from this version are removed; their pre-install originals return.
  const shipped = new Set(contents.map(([relative]) => relative));
  const removals = [];
  for (const [relative, entry] of Object.entries(manifest.files)) {
    if (shipped.has(relative) || relative === '.gitignore') continue;
    const sourcePath = migrate.sources?.get(entry.backup?.path) || entry.backup?.path;
    if (entry.backup && (!regular(root, sourcePath) ||
        hash(fs.readFileSync(path.join(root, sourcePath))) !== entry.backup.hash)) {
      throw new Error(`Cannot remove retired file: backup missing or modified (${sourcePath}).`);
    }
    const backup = entry.backup;
    removals.push({ relative, backup, present: Boolean(regular(root, relative)) });
    delete manifest.files[relative];
  }
  console.log(`${dryRun ? 'Dry run: would install' : 'Installing'} ${writes.length} file(s) in ${root}`);
  if (dryRun) {
    migrate(true);
    for (const { relative, current, backup } of writes) {
      console.log(`  ${current ? 'REPLACE' : 'ADD'} ${relative}`);
      if (backup) console.log(`  BACK UP ${relative} -> ${backup.path}`);
    }
    for (const { relative, backup, present } of removals) {
      if (backup) console.log(`  RESTORE ${relative} <- ${backup.path}`);
      else if (present) console.log(`  DELETE ${relative} (no longer shipped)`);
    }
    console.log(`  KEEP ${PRESERVED.join(', ')}`);
    console.log(`  WRITE ${MANIFEST} (ownership/recovery metadata)`);
    return;
  }
  fs.mkdirSync(root, { recursive: true });
  migrate(false);
  for (const { relative, current, backup } of writes) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    if (backup) {
      fs.mkdirSync(path.dirname(safePath(root, backup.path)), { recursive: true, mode: 0o700 });
      fs.writeFileSync(path.join(root, backup.path), current, { flag: 'wx', mode: backup.mode });
      console.log(`Saved backup: ${backup.path}`);
    }
  }
  saveManifest(root, manifest);
  for (const { relative, data } of writes) fs.writeFileSync(path.join(root, relative), data);
  for (const { relative, backup, present } of removals) {
    const file = path.join(root, relative);
    if (backup) {
      fs.copyFileSync(path.join(root, backup.path), file);
      fs.chmodSync(file, backup.mode ?? 0o600);
      fs.unlinkSync(path.join(root, backup.path));
      console.log(`Restored ${relative} from ${backup.path}; FlutterCrew no longer ships it.`);
    } else if (present) {
      fs.rmSync(file, { force: true });
      console.log(`Removed ${relative}; FlutterCrew no longer ships it.`);
    }
  }
  manifest.directories = pruneEmptyDirectories(root, manifest.directories,
    removals.map(({ relative }) => path.posix.dirname(relative)));
  saveManifest(root, manifest);
  pruneRecoveryDirectories(root);
  console.log(`FlutterCrew installation complete. Project documents and run evidence were not touched: ${PRESERVED.join(', ')}.`);
}

/** Remove empty owned directories and empty parents of removed files, deepest first. */
function pruneEmptyDirectories(root, owned, candidates = []) {
  const all = new Set(owned);
  for (let directory of candidates) {
    while (directory !== '.' && ITEMS.some((item) => directory === item || directory.startsWith(`${item}/`))) {
      all.add(directory);
      directory = path.posix.dirname(directory);
    }
  }
  const kept = [];
  for (const directory of [...all].sort((a, b) => b.length - a.length)) {
    const full = safePath(root, directory);
    if (!stat(full)) continue;
    if (fs.readdirSync(full).length) {
      if (owned.includes(directory)) kept.push(directory);
      continue;
    }
    fs.rmdirSync(full);
  }
  return kept;
}

function uninstall(source, target, { dryRun = false } = {}) {
  const root = canonicalRoot(target);
  safePath(root);
  if (root === canonicalRoot(source)) throw new Error('Cannot uninstall inside FlutterCrew source workspace.');
  if (!regular(root, MANIFEST) && !regular(root, LEGACY_MANIFEST)) {
    console.log('No installation manifest found; nothing removed. Legacy files/backups require manual review.');
    return;
  }
  const manifest = readManifest(root);
  const migrate = prepareMigration(root, manifest);
  const actions = [];
  for (const [relative, entry] of Object.entries(manifest.files)) {
    const file = path.join(root, relative);
    const current = stat(file) ? fs.readFileSync(file) : null;
    const backup = entry.backup;
    if (relative === '.gitignore' && current && hash(current) !== entry.hash) {
      console.log(`Retained modified file and backup: ${relative}; recover using ${MANIFEST}.`);
      continue;
    }
    const sourcePath = migrate.sources?.get(backup?.path) || backup?.path;
    if (backup && (!stat(path.join(root, sourcePath)) ||
        hash(fs.readFileSync(path.join(root, sourcePath))) !== backup.hash)) {
      console.log(`Retained ${relative}: backup missing or modified (${backup.path}); review manually.`);
      continue;
    }
    actions.push({ relative, backup });
  }
  const unresolved = actions.length < Object.keys(manifest.files).length;
  const evidenceRemains = Boolean(stat(safePath(root, '.fluttercrew')));
  let privacyUpdate = null;
  if (migrate.sources && (unresolved || evidenceRemains)) {
    const ignore = regular(root, '.gitignore') ? fs.readFileSync(path.join(root, '.gitignore'), 'utf8') : '';
    if (!ignore.split(/\r?\n/).includes(`${INSTALLER_DIR}/`)) {
      if (!manifest.files['.gitignore'] || hash(Buffer.from(ignore)) !== manifest.files['.gitignore'].hash) {
        throw new Error(`Add ${INSTALLER_DIR}/ to .gitignore before migrating retained recovery files. Nothing was changed.`);
      }
      privacyUpdate = `${ignore}${ignore && !ignore.endsWith('\n') ? '\n' : ''}${INSTALLER_DIR}/\n`;
    }
  }
  if (unresolved || evidenceRemains) {
    const ignoreIndex = actions.findIndex((action) => action.relative === '.gitignore');
    if (ignoreIndex !== -1) {
      actions.splice(ignoreIndex, 1);
      console.log('Retained owned .gitignore privacy rules while recovery files or .fluttercrew evidence remain.');
    }
  }
  console.log(`${dryRun ? 'Dry run: would restore/remove' : 'Restoring/removing'} ${actions.length} owned file(s).`);
  if (dryRun) {
    migrate(true);
    if (privacyUpdate !== null) console.log(`  UPDATE .gitignore to protect ${INSTALLER_DIR}/`);
    for (const { relative, backup } of actions) {
      console.log(`  ${backup ? 'RESTORE' : 'REMOVE'} ${relative}${backup ? ` <- ${backup.path}` : ''}`);
      if (backup) console.log(`  CONSUME unchanged owned backup ${backup.path}`);
    }
    console.log(`  ${actions.length === Object.keys(manifest.files).length ? 'REMOVE' : 'RETAIN/UPDATE'} ${MANIFEST}`);
    return;
  }
  migrate(false);
  if (privacyUpdate !== null) {
    fs.writeFileSync(path.join(root, '.gitignore'), privacyUpdate);
    manifest.files['.gitignore'].hash = hash(Buffer.from(privacyUpdate));
    saveManifest(root, manifest);
  }
  for (const { relative, backup } of actions) {
    const file = path.join(root, relative);
    if (backup) {
      fs.copyFileSync(path.join(root, backup.path), file);
      fs.chmodSync(file, backup.mode ?? 0o600);
      fs.unlinkSync(path.join(root, backup.path));
      console.log(`Restored ${relative}; consumed unchanged owned backup ${backup.path}.`);
    } else {
      fs.rmSync(file, { force: true });
    }
    delete manifest.files[relative];
    saveManifest(root, manifest);
  }
  manifest.directories = manifest.directories.sort((a, b) => b.length - a.length).filter((directory) => {
    const full = path.join(root, directory);
    if (!stat(full)) return false;
    if (fs.readdirSync(full).length) return true;
    fs.rmdirSync(full);
    return false;
  });
  if (Object.keys(manifest.files).length) {
    saveManifest(root, manifest);
    console.log(`Partial uninstall: retained changed files/backups and ${MANIFEST}. No run evidence was removed.`);
  } else {
    fs.unlinkSync(path.join(root, MANIFEST));
    console.log(`Uninstalled FlutterCrew files. Kept custom files, unrelated backups and ${PRESERVED.join(', ')}.`);
  }
  pruneRecoveryDirectories(root);
}

module.exports = { install, uninstall, safePath };
