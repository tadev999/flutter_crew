'use strict';

const path = require('node:path');
const { listFiles, read } = require('./fsutil');

/**
 * Static, conservative project checks that run before verification.
 * These are heuristics, not a security audit or backend connectivity test.
 * @returns {string[]} human-readable issues (empty when clean)
 */
function preflight(root, backend) {
  const issues = [];
  const requireFile = (name) => {
    if (!read(path.join(root, name)).trim()) issues.push(`Missing/empty ${name}`);
  };
  requireFile('pubspec.yaml');
  requireFile('lib/main.dart');
  const dart = listFiles(path.join(root, 'lib')).filter((file) => file.endsWith('.dart'))
    .map((file) => read(file)).join('\n');
  const capabilities = backendCapabilities(root, backend, dart);

  if (backend === 'firebase') firebaseIssues(root, dart, capabilities, issues, requireFile);
  if (backend === 'supabase') supabaseIssues(root, dart, capabilities, issues);
  if (/\b(?:Fake|Mock|Dummy|InMemory)\w*(?:Repository|DataSource)\b/.test(dart)) {
    issues.push('Possible runtime fake backend found in lib; remove or review explicitly.');
  }
  return issues;
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

function firebaseIssues(root, dart, capabilities, issues, requireFile) {
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
    } catch { issues.push(`Invalid JSON object in ${name}`); }
  }
  if (!/Firebase\.initializeApp\s*\(/.test(dart)) {
    issues.push('Firebase initialization not found. Initialize Firebase before using its services (static heuristic).');
  }
  if (capabilities.firestore && !/withConverter\s*</.test(dart)) {
    issues.push('Typed Firestore converter not found. Add withConverter<T> for Firestore data access.');
  }
  for (const [enabled, name, label] of [
    [capabilities.firestore, 'firestore.rules', 'Firestore'],
    [capabilities.storage, 'storage.rules', 'Storage']
  ]) {
    if (enabled && /allow\s+[^;]+:\s*if\s+(true|request\.auth\s*!=\s*null)\s*;/.test(read(path.join(root, name)))) {
      issues.push(`Over-broad ${label} permission detected; review ownership/schema in ${name}.`);
    }
  }
}

function supabaseIssues(root, dart, capabilities, issues) {
  if (!/Supabase\.initialize\s*\(/.test(dart)) issues.push('Supabase initialization not found.');
  if (!capabilities.database && !capabilities.storage) return;
  const migrations = listFiles(path.join(root, 'supabase/migrations'))
    .filter((file) => file.endsWith('.sql')).map((file) => read(file)).join('\n');
  if (capabilities.database &&
      (!/enable\s+row\s+level\s+security/i.test(migrations) || !/create\s+policy/i.test(migrations))) {
    issues.push('RLS migrations/policies not found. Add reviewed database authorization in supabase/migrations.');
  }
  if (capabilities.storage && !/create\s+policy[\s\S]*?\bon\s+storage\.objects\b/i.test(migrations)) {
    issues.push('Storage policies not found. Add reviewed policies on storage.objects in supabase/migrations.');
  }
}

module.exports = { preflight, backendCapabilities };
