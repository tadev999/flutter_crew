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

  if (backend === 'firebase') firebaseIssues(root, dart, issues, requireFile);
  if (backend === 'supabase') supabaseIssues(root, dart, issues);
  if (/\b(?:Fake|Mock|Dummy|InMemory)\w*(?:Repository|DataSource)\b/.test(dart)) {
    issues.push('Possible runtime fake backend found in lib; remove or review explicitly.');
  }
  return issues;
}

function firebaseIssues(root, dart, issues, requireFile) {
  ['lib/firebase_options.dart', 'firebase.json', 'firestore.rules', 'firestore.indexes.json'].forEach(requireFile);
  for (const name of ['firebase.json', 'firestore.indexes.json']) {
    const value = read(path.join(root, name));
    if (!value.trim()) continue;
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required');
    } catch { issues.push(`Invalid JSON object in ${name}`); }
  }
  if (!/Firebase\.initializeApp\s*\(/.test(dart) || !/DefaultFirebaseOptions\.currentPlatform/.test(dart)) {
    issues.push('Firebase initialization/options not found (static heuristic).');
  }
  if (!/withConverter\s*</.test(dart)) issues.push('Typed Firestore converter not found.');
  const rules = read(path.join(root, 'firestore.rules'));
  if (/allow\s+[^;]+:\s*if\s+(true|request\.auth\s*!=\s*null)\s*;/.test(rules)) {
    issues.push('Over-broad Firestore permission detected; review ownership/schema.');
  }
}

function supabaseIssues(root, dart, issues) {
  if (!/Supabase\.initialize\s*\(/.test(dart)) issues.push('Supabase initialization not found.');
  const migrations = listFiles(path.join(root, 'supabase/migrations'))
    .filter((file) => file.endsWith('.sql')).map((file) => read(file)).join('\n');
  if (!/enable\s+row\s+level\s+security/i.test(migrations) || !/create\s+policy/i.test(migrations)) {
    issues.push('RLS migrations/policies not found.');
  }
}

module.exports = { preflight };
