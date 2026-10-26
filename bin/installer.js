'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MANIFEST = '.fluttercrew-install.json';
const ITEMS = ['.vscode', '.github', '.agents', '.cursorrules', 'AGENTS.md', 'GEMINI.md', 'CLAUDE.md'];
const CONFIG = new Set(['.vscode/settings.json', '.vscode/tasks.json', '.vscode/extensions.json']);
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
  if (!regular(root, MANIFEST)) return { version: 1, files: {}, directories: [] };
  const value = JSON.parse(fs.readFileSync(path.join(root, MANIFEST), 'utf8'));
  if (value.version !== 1 || !value.files || typeof value.files !== 'object' ||
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
          !entry.backup.path.startsWith(`${relative}.fluttercrew-`) ||
          !entry.backup.path.endsWith('.bak') || !/^[a-f0-9]{64}$/.test(entry.backup.hash)) {
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
    if (relative === '.github/workflows/ci.yml') return;
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
  const pending = path.join(root, `${MANIFEST}.${crypto.randomUUID()}.pending`);
  try {
    fs.writeFileSync(pending, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    fs.renameSync(pending, path.join(root, MANIFEST));
  } finally {
    fs.rmSync(pending, { force: true });
  }
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
  const writes = [];
  const contents = sourceFiles(source).map((relative) => [relative, fs.readFileSync(path.join(source, relative))]);
  const ignoreInfo = regular(root, '.gitignore');
  const originalIgnore = ignoreInfo ? fs.readFileSync(path.join(root, '.gitignore'), 'utf8') : '';
  const missing = ['.fluttercrew/', MANIFEST, '*.fluttercrew-*.bak']
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
    if (owned && (!current || hash(current) !== owned.hash)) {
      console.log(`Preserved locally changed/deleted file: ${relative}; ownership retained for recovery.`);
      continue;
    }
    if (!owned && current && CONFIG.has(relative)) {
      console.log(`Preserved existing ${relative} unchanged (JSON/JSONC); configure FlutterCrew manually if needed.`);
      continue;
    }
    if (current && current.equals(data)) continue;
    let backup = owned?.backup || null;
    if (!owned && current) {
      backup = {
        path: `${relative}.fluttercrew-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.bak`,
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
  console.log(`${dryRun ? 'Dry run: would install' : 'Installing'} ${writes.length} file(s) in ${root}`);
  if (dryRun) {
    for (const { relative, current, backup } of writes) {
      console.log(`  ${current ? 'REPLACE' : 'ADD'} ${relative}`);
      if (backup) console.log(`  BACK UP ${relative} -> ${backup.path}`);
    }
    console.log(`  WRITE ${MANIFEST} (ownership/recovery metadata)`);
    return;
  }
  fs.mkdirSync(root, { recursive: true });
  for (const { relative, current, backup } of writes) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    if (backup) {
      fs.writeFileSync(path.join(root, backup.path), current, { flag: 'wx', mode: backup.mode });
      console.log(`Saved backup: ${backup.path}`);
    }
  }
  saveManifest(root, manifest);
  for (const { relative, data } of writes) fs.writeFileSync(path.join(root, relative), data);
  console.log('FlutterCrew installation complete. Existing local settings and run evidence are preserved.');
}

function uninstall(source, target, { dryRun = false } = {}) {
  const root = canonicalRoot(target);
  safePath(root);
  if (root === canonicalRoot(source)) throw new Error('Cannot uninstall inside FlutterCrew source workspace.');
  if (!regular(root, MANIFEST)) {
    console.log('No installation manifest found; nothing removed. Legacy files/backups require manual review.');
    return;
  }
  const manifest = readManifest(root);
  const actions = [];
  for (const [relative, entry] of Object.entries(manifest.files)) {
    const file = path.join(root, relative);
    const current = stat(file) ? fs.readFileSync(file) : null;
    const backup = entry.backup;
    if (current && hash(current) !== entry.hash) {
      console.log(`Retained modified file and backup: ${relative}; recover using ${MANIFEST}.`);
      continue;
    }
    if (backup && (!stat(path.join(root, backup.path)) ||
        hash(fs.readFileSync(path.join(root, backup.path))) !== backup.hash)) {
      console.log(`Retained ${relative}: backup missing or modified (${backup.path}); review manually.`);
      continue;
    }
    actions.push({ relative, backup });
  }
  const unresolved = actions.length < Object.keys(manifest.files).length;
  const evidenceRemains = Boolean(stat(safePath(root, '.fluttercrew')));
  if (unresolved || evidenceRemains) {
    const ignoreIndex = actions.findIndex((action) => action.relative === '.gitignore');
    if (ignoreIndex !== -1) {
      actions.splice(ignoreIndex, 1);
      console.log('Retained owned .gitignore privacy rules while recovery files or .fluttercrew evidence remain.');
    }
  }
  console.log(`${dryRun ? 'Dry run: would restore/remove' : 'Restoring/removing'} ${actions.length} owned file(s).`);
  if (dryRun) {
    for (const { relative, backup } of actions) {
      console.log(`  ${backup ? 'RESTORE' : 'REMOVE'} ${relative}${backup ? ` <- ${backup.path}` : ''}`);
      if (backup) console.log(`  CONSUME unchanged owned backup ${backup.path}`);
    }
    console.log(`  ${actions.length === Object.keys(manifest.files).length ? 'REMOVE' : 'RETAIN/UPDATE'} ${MANIFEST}`);
    return;
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
    console.log('Uninstalled owned files. Custom files, unrelated backups and .fluttercrew run evidence were not removed.');
  }
}

module.exports = { install, uninstall, safePath };
