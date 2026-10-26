'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { preflight } = require('../.agents/runtime/preflight');

function project(t, source) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluttercrew-preflight-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name, text) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  write('pubspec.yaml', 'name: capability_fixture\n');
  write('lib/main.dart', source);
  return { root, write };
}

test('Firebase Auth-only does not require Firestore or Storage resources', (t) => {
  const p = project(t, `
    import 'package:firebase_auth/firebase_auth.dart';
    void main() {
      Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
      FirebaseAuth.instance.authStateChanges();
    }
  `);
  p.write('lib/firebase_options.dart', 'class DefaultFirebaseOptions {}');
  assert.deepEqual(preflight(p.root, 'firebase'), []);
});

test('native Firebase configuration does not require generated Dart options', (t) => {
  const p = project(t, 'void main() { Firebase.initializeApp(); FirebaseAuth.instance; }');
  assert.deepEqual(preflight(p.root, 'firebase'), []);
});

test('Firestore usage still requires rules, indexes, config and converters', (t) => {
  const p = project(t, 'void main() { Firebase.initializeApp(); FirebaseFirestore.instance; }');
  const issues = preflight(p.root, 'firebase');
  for (const expected of ['firebase.json', 'firestore.rules', 'firestore.indexes.json', 'converter']) {
    assert.ok(issues.some((issue) => issue.includes(expected)), issues.join('\n'));
  }
  p.write('firebase.json', '{"firestore":{}}');
  p.write('firestore.rules', 'allow read, write: if false;');
  p.write('firestore.indexes.json', '{"indexes":[]}');
  p.write('lib/records.dart', 'final records = FirebaseFirestore.instance.withConverter<Record>();');
  assert.deepEqual(preflight(p.root, 'firebase'), []);
});

test('Firebase Storage requires its own rules, not Firestore resources', (t) => {
  const p = project(t, 'void main() { Firebase.initializeApp(); FirebaseStorage.instance; }');
  assert.deepEqual(preflight(p.root, 'firebase'), [
    'Missing/empty firebase.json', 'Missing/empty storage.rules'
  ]);
  p.write('firebase.json', '{"storage":{}}');
  p.write('storage.rules', 'allow read, write: if request.auth != null;');
  assert.ok(preflight(p.root, 'firebase').some((issue) => issue.includes('Over-broad Storage')));
  p.write('storage.rules', 'allow read, write: if false;');
  assert.deepEqual(preflight(p.root, 'firebase'), []);
});

test('Firebase configuration and existing rules are inspected even before service code exists', (t) => {
  const p = project(t, 'void main() { Firebase.initializeApp(); }');
  p.write('firebase.json', '{"firestore":{}}');
  assert.ok(preflight(p.root, 'firebase').some((issue) => issue.includes('firestore.rules')));
  p.write('storage.rules', 'allow read: if true;');
  assert.ok(preflight(p.root, 'firebase').some((issue) => issue.includes('Over-broad Storage')));
});

test('Supabase Auth-only does not require database migrations', (t) => {
  const p = project(t, 'void main() { Supabase.initialize(); Supabase.instance.client.auth.signInWithPassword(); }');
  assert.deepEqual(preflight(p.root, 'supabase'), []);
});

test('Supabase database usage is detected alongside Auth', (t) => {
  const p = project(t, `
    void main() {
      Supabase.initialize();
      client.auth.currentUser;
      client.from('profiles').select();
    }
  `);
  assert.ok(preflight(p.root, 'supabase').some((issue) => issue.includes('RLS')));
  p.write('supabase/migrations/001.sql',
    'alter table profiles enable row level security; create policy owner on profiles using (auth.uid() = user_id);');
  assert.deepEqual(preflight(p.root, 'supabase'), []);
});

test('Supabase RPC and Postgres realtime both require database authorization', (t) => {
  const p = project(t, 'void main() { Supabase.initialize(); client.auth.currentUser; client.rpc("stats"); }');
  assert.ok(preflight(p.root, 'supabase').some((issue) => issue.includes('RLS')));
  p.write('lib/main.dart', 'void main() { Supabase.initialize(); client.auth.currentUser; channel.onPostgresChanges(); }');
  assert.ok(preflight(p.root, 'supabase').some((issue) => issue.includes('RLS')));
});

test('Supabase Storage requires storage policies without requiring custom table RLS', (t) => {
  const p = project(t, 'void main() { Supabase.initialize(); client.storage.from("avatars").upload(); }');
  assert.deepEqual(preflight(p.root, 'supabase'), [
    'Storage policies not found. Add reviewed policies on storage.objects in supabase/migrations.'
  ]);
  p.write('supabase/migrations/001.sql',
    'create policy owner on storage.objects for select using (auth.uid() = owner_id::uuid);');
  assert.deepEqual(preflight(p.root, 'supabase'), []);
});

test('existing application migrations are checked even for an Auth-only source', (t) => {
  const p = project(t, 'void main() { Supabase.initialize(); client.auth.currentUser; }');
  p.write('supabase/migrations/001.sql', 'create table profiles (id uuid);');
  assert.ok(preflight(p.root, 'supabase').some((issue) => issue.includes('RLS')));
});

test('unknown Supabase usage retains conservative database checks', (t) => {
  const p = project(t, 'void main() { Supabase.initialize(); }');
  assert.ok(preflight(p.root, 'supabase').some((issue) => issue.includes('RLS')));
});
