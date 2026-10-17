'use strict';

// These are file-contract tests, not end-to-end tests of an IDE or LLM behavior.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('delivery entrypoints share prompt-first intake instead of file-only input', () => {
  for (const name of ['AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md',
    '.github/agents/fluttercrew.agent.md', '.github/prompts/fluttercrew-deliver.prompt.md',
    '.agents/workflows/fluttercrew-deliver.md', '.agents/workflows/feature-delivery.md',
    '.agents/workflows/spec-driven-delivery.md']) {
    const text = read(name);
    assert.ok(text.includes('input-intake.md'), `Missing intake reference: ${name}`);
    assert.match(text, /direct|inline/i, `Missing prompt input support: ${name}`);
  }
  const shortcut = read('.github/prompts/fluttercrew-deliver.prompt.md');
  assert.doesNotMatch(shortcut, /locate the unambiguous requirements document\s+or ask for its path/i);
});

test('intake documents safe capture, existing-run preservation and unchanged gates', () => {
  const text = read('.agents/workflows/input-intake.md');
  for (const required of ['User request', 'Agent assumptions', '[REDACTED]',
    'never reset', 'do not replace an existing file', 'not shell-interpolated',
    'spec-driven-delivery.md', 'No weaker gates', 'Do not invent']) {
    assert.ok(text.includes(required), `Missing intake constraint: ${required}`);
  }
});

test('README keeps direct-prompt onboarding and valid local documentation links', () => {
  const text = read('README.md');
  assert.ok(text.includes('No special wording or requirements file is needed.'));
  assert.ok(text.includes('Firebase Auth and Firestore'));
  assert.ok(text.includes('Google Antigravity'));
  assert.ok(text.includes('/fluttercrew-deliver'));
  assert.equal((text.match(/^```/gm) || []).length % 2, 0);
  for (const match of text.matchAll(/`\/([a-z][a-z-]*)\b[^`]*`/g)) {
    assert.ok(fs.existsSync(path.join(root, '.github/prompts', `${match[1]}.prompt.md`)),
      `Documented shortcut has no prompt file: ${match[1]}`);
  }
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|#)/.test(target)) continue;
    assert.ok(fs.existsSync(path.join(root, decodeURIComponent(target.split('#')[0]))), target);
  }
});