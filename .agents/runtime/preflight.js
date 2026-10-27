'use strict';

const path = require('node:path');
const { listFiles, read } = require('./fsutil');
const { loadConfig } = require('./config');

/**
 * Static, conservative project checks that run before verification.
 * These are heuristics, not a security audit or backend connectivity test.
 *
 * Every finding has a stable rule id. A project can suppress a rule in
 * docs/fluttercrew/config.json, but only with a written reason, and the
 * suppression is reported (never silent).
 *
 * Rule ids: missing-file, missing-entrypoint, runtime-fake, firebase-json,
 * firebase-init, typed-converter, broad-firestore, broad-storage,
 * supabase-init, supabase-rls, supabase-storage.
 */
function preflightDetail(root, backend) {
  const config = loadConfig(root);
  const findings = [];
  const add = (rule, message) => findings.push({ rule, message });
  const requireFile = (name) => {
    if (!read(path.join(root, name)).trim()) add('missing-file', `Missing/empty ${name}`);
  };

  requireFile('pubspec.yaml');
  if (!hasEntrypoint(root, config)) add('missing-entrypoint', 'Missing/empty lib/main.dart');
  const dart = listFiles(path.join(root, 'lib')).filter((file) => file.endsWith('.dart'))
    .map((file) => read(file)).join('\n');
  const capabilities = backendCapabilities(root, backend, dart);

  if (backend === 'firebase') firebaseIssues(root, dart, capabilities, add, requireFile);
  if (backend === 'supabase') supabaseIssues(root, dart, capabilities, add);
  if (/\b(?:Fake|Mock|Dummy|InMemory)\w*(?:Repository|DataSource)\b/.test(dart)) {
    add('runtime-fake', 'Possible runtime fake backend found in lib; remove or review explicitly.');
  }

  const suppressed = [];
  const issues = [];
  for (const finding of findings) {
    const rule = config.suppress.find((entry) => entry.rule === finding.rule);
    if (rule) suppressed.push({ ...finding, reason: rule.reason });
    else issues.push(finding);
  }
  if (config.error) issues.push({ rule: 'config', message: config.error });
  return { issues, suppressed };
}

/** Back-compat API: just the blocking messages. */
function preflight(root, backend) {
  return preflightDetail(root, backend).issues.map((entry) => entry.message);
}

/** lib/main.dart, a flavor entrypoint (lib/main_*.dart) or a configured entrypoint. */
function hasEntrypoint(root, config) {
  if (read(path.join(root, 'lib/main.dart')).trim()) return true;
  if (config.entrypoints.some((file) => read(path.join(root, file)).trim())) return true;
  return listFiles(path.join(root, 'lib')).some((file) =>
    /[\\/]main_[^\\/]+\.dart$/.test(file) && path.dirname(file) === path.join(root, 'lib') && read(file).trim());
}

function backendCapabilities(root, backend, dart) {
  if (backend === 'firebase') {
    const config = read(path.join(root, 'firebase.json'));
    return {
      firestore: /package:cloud_firestore\/|FirebaseFirestore\b/.test(dart) ||
        Boolean(read(path.join(root, 'firestore.rules')).trim()) ||
        /"firestore"\s*:/.test(config),
      storage: /package:firebase_storage\/|FirebaseStorage\b/.test(dart) ||
        Boolean(read(path.join(root, 'storage.rules')).trim()) ||
        /"storage"\s*:/.test(config)
    };
  }
  if (backend === 'supabase') {
    const withoutStorageQueries = dart.replace(/\.storage\s*\.from\s*\(/g, '.storageBucket(');
    const database = /\.from\s*\(|\.rpc\s*\(|\.onPostgresChanges\s*\(/.test(withoutStorageQueries);
    const auth = /\.auth\b/.test(dart);
    const migrations = listFiles(path.join(root, 'supabase/migrations'))
      .filter((file) => file.endsWith('.sql')).map((file) => read(file)).join('\n');
    const storage = /\.storage\b/.test(dart) || /\bstorage\.objects\b/i.test(migrations);
    const applicationTables = /\b(?:create|alter)\s+table\s+(?:if\s+not\s+exists\s+)?(?!storage\.)[\w"]/i.test(migrations);
    return {
      database: database || applicationTables || (Boolean(migrations.trim()) && !storage) || (!auth && !storage),
      storage
    };
  }
  return {};
}

function firebaseIssues(root, dart, capabilities, add, requireFile) {
  if (/DefaultFirebaseOptions\b/.test(dart) || !/Firebase\.initializeApp\s*\(/.test(dart)) {
    requireFile('lib/firebase_options.dart');
  }
  if (capabilities.firestore || capabilities.storage) requireFile('firebase.json');
  if (capabilities.firestore) {
    ['firestore.rules', 'firestore.indexes.json'].forEach(requireFile);
  }
  if (capabilities.storage) requireFile('storage.rules');
  for (const name of ['firebase.json', 'firestore.indexes.json']) {
    const value = read(path.join(root, name));
    if (!value.trim()) continue;
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required');
    } catch { add('firebase-json', `Invalid JSON object in ${name}`); }
  }
  if (!/Firebase\.initializeApp\s*\(/.test(dart)) {
    add('firebase-init', 'Firebase initialization not found. Initialize Firebase before using its services (static heuristic).');
  }
  if (capabilities.firestore && !/withConverter\s*</.test(dart) && !/FirestoreDataConverter\b/.test(dart) && !/\bfromFirestore\b/.test(dart)) {
    add('typed-converter', 'Typed Firestore converter not found. Add withConverter<T> for Firestore data access.');
  }
  for (const [enabled, name, label, rule] of [
    [capabilities.firestore, 'firestore.rules', 'Firestore', 'broad-firestore'],
    [capabilities.storage, 'storage.rules', 'Storage', 'broad-storage']
  ]) {
    if (enabled && /allow\s+[^;]+:\s*if\s+(true|request\.auth\s*!=\s*null)\s*;/.test(read(path.join(root, name)))) {
      add(rule, `Over-broad ${label} permission detected; review ownership/schema in ${name}.`);
    }
  }
}

function supabaseIssues(root, dart, capabilities, add) {
  if (!/Supabase\.initialize\s*\(/.test(dart)) add('supabase-init', 'Supabase initialization not found.');
  if (!capabilities.database && !capabilities.storage) return;
  const migrations = listFiles(path.join(root, 'supabase/migrations'))
    .filter((file) => file.endsWith('.sql')).map((file) => read(file)).join('\n');
  if (capabilities.database &&
      (!/enable\s+row\s+level\s+security/i.test(migrations) || !/create\s+policy/i.test(migrations))) {
    add('supabase-rls', 'RLS migrations/policies not found. Add reviewed database authorization in supabase/migrations.');
  }
  if (capabilities.storage && !/create\s+policy[\s\S]*?\bon\s+storage\.objects\b/i.test(migrations)) {
    add('supabase-storage', 'Storage policies not found. Add reviewed policies on storage.objects in supabase/migrations.');
  }
}

module.exports = { preflight, preflightDetail, backendCapabilities };
