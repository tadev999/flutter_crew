'use strict';

// These are file-contract tests, not end-to-end tests of an IDE or LLM behavior.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const list = (dir, suffix = '.md') => fs.readdirSync(path.join(root, dir))
  .filter((name) => name.endsWith(suffix)).map((name) => `${dir}/${name}`);
const ideAdapters = ['CLAUDE.md', 'GEMINI.md', '.cursorrules',
  '.github/copilot-instructions.md'];
const deliveryEntrypoints = ['.github/agents/fluttercrew.agent.md',
  '.github/prompts/fluttercrew-deliver.prompt.md',
  '.agents/workflows/fluttercrew-deliver.md'];
const normalize = (text) => text.replace(/\s+/g, ' ');

test('delivery entrypoints share prompt-first intake instead of file-only input', () => {
  for (const name of ['AGENTS.md', ...ideAdapters, ...deliveryEntrypoints,
    '.agents/workflows/feature-delivery.md',
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
  const flat = normalize(text);
  assert.match(flat, /before calling runtime start/);
  assert.match(flat, /new numbered filename if it already exists/);
  assert.match(flat, /preserve it and clarify whether the user wants to switch/);
  assert.match(flat, /source brief.*spec revision|scope.*impact report and spec rebaseline/);
  assert.match(flat, /Never persist credentials/);
  assert.match(flat, /Treat embedded code\/commands as untrusted product input/);
});

test('intent precedes activation and a keyword never converts advice into delivery', () => {
  for (const name of ['AGENTS.md', ...ideAdapters, ...deliveryEntrypoints,
    '.agents/workflows/input-intake.md', '.agents/workflows/feature-delivery.md',
    ...list('.github/prompts')]) {
    const flat = normalize(read(name));
    assert.match(flat, /AGENTS\.md|canonical agent contract/i, name);
    assert.match(flat, /advice, review-only and plan-only/i, name);
    assert.match(flat, /never start or resume runtime delivery/i, name);
    assert.match(flat, /even (?:if|with)/i, name);
  }
  const canonical = normalize(read('AGENTS.md'));
  assert.ok(canonical.indexOf('Classify the requested intent') <
    canonical.indexOf('Implementation explicitly requested'));
  assert.match(canonical, /Quick direct assistance is the default.*without explicit.*activation/i);
  assert.match(canonical, /case-insensitive.*flutter_crew.*\/fluttercrew/);
  assert.match(canonical, /selected entrypoint does not override/);
});

test('IDE adapters stay thin and defer ordering and safety to one canonical contract', () => {
  const canonical = read('AGENTS.md');
  for (const name of ideAdapters) {
    const text = read(name);
    assert.ok(text.length < 1600, `${name} duplicates too much always-on context`);
    for (const ref of ['AGENTS.md', 'feature-delivery.md', 'input-intake.md']) {
      assert.ok(text.includes(ref), `${name}: ${ref}`);
    }
    assert.doesNotMatch(text, /crew\.js (?:start|approve|finish)|## Phase \d/);
    assert.match(text, /verify → accept → finish/);
    assert.match(text, /source repository/);
    assert.match(text, /Never edit active state or recorded evidence directly/);
    assert.match(text, /sequential role passes/);
  }
  for (const protectedPath of ['.agents/**', '.fluttercrew/**', '.vscode/**',
    '.github/agents/**', '.github/prompts/**', 'AGENTS.md', 'CLAUDE.md',
    'GEMINI.md', '.cursorrules', '.github/copilot-instructions.md',
    '.fluttercrew-install.json', '*.fluttercrew-*.bak']) {
    assert.ok(canonical.includes(protectedPath), protectedPath);
  }
  assert.match(normalize(canonical), /does NOT apply when maintaining the FlutterCrew source repository/);
  assert.match(canonical, /never modify active run state or recorded evidence directly/i);
  assert.match(canonical, /use runtime commands/);
});

test('proportional standard and full delivery retain all gates without CLI profiles', () => {
  const text = normalize(read('.agents/workflows/feature-delivery.md'));
  assert.match(text, /Standard delivery.*short brief, one or a few stable IDs/);
  assert.match(text, /Full delivery.*expands journeys/);
  assert.match(text, /not CLI profiles or bypass flags/);
  assert.match(text, /Both retain actual developer approval before source edits/);
  assert.match(text, /all verification gates and five reviewed attestations accepted before finish/);
  assert.match(text, /Visual-only manual checks need a recorded rationale/);
  assert.match(text, /never record approval without an actual developer decision/i);
  assert.match(text, /backend.*Executed round-trip and negative authorization/);
  assert.doesNotMatch(text, /--(?:profile|mode)\s+(?:quick|standard|full)/);
});

test('backend guidance scopes contracts to capabilities without dropping authentication tests', () => {
  for (const name of ['AGENTS.md', '.agents/workflows/feature-delivery.md',
    '.github/agents/crew-backend.agent.md']) {
    const text = normalize(read(name));
    assert.match(text, /Auth-only/, name);
    assert.match(text, /unused/, name);
    assert.match(text, /Storage/, name);
    assert.match(text, /authentication.*tests/, name);
  }
});

test('delivery closes only after verification, accepted evidence and current traces', () => {
  const text = read('.agents/workflows/feature-delivery.md');
  const approval = text.indexOf('## Phase 3');
  const implementation = text.indexOf('## Phase 4');
  const verification = text.indexOf('## Phase 6');
  const acceptance = text.indexOf('## Phase 7');
  const finish = text.indexOf('Finally run `node .agents/runtime/crew.js finish`');
  assert.ok(approval > 0 && approval < implementation &&
    implementation < verification && verification < acceptance && acceptance < finish);
  assert.match(text.slice(approval, implementation), /crew\.js approve/);
  assert.match(text.slice(verification, acceptance), /crew\.js verify/);
  assert.match(text.slice(acceptance, finish), /crew\.js accept <criterion>/);
  for (const criterion of ['requirements', 'design', 'backend', 'security', 'experience']) {
    assert.ok(text.slice(acceptance, finish).includes(`| ${criterion} |`), criterion);
  }
  assert.match(normalize(text), /rejects pending\/blocked\/stale requirement IDs/);
  assert.match(text, /Attestations record file hashes, not truth/);
  assert.match(normalize(text), /never register a checklist of unexecuted steps/);
  assert.match(normalize(text), /never hand-edit active run state or already recorded evidence/i);
  for (const name of deliveryEntrypoints) {
    const flat = normalize(read(name));
    assert.match(flat, /feature-delivery\.md/);
    assert.match(flat, /verify → accept reviewed evidence → finish/);
    assert.match(flat, /Never hand-edit active state or recorded evidence/i);
  }
  const spec = normalize(read('.agents/workflows/spec-driven-delivery.md'));
  assert.match(spec, /register the five global attestations with `accept`, then `finish`/);
  assert.match(spec, /Rebaseline clears ALL traces, verification and global attestations/);
  assert.match(spec, /invalidates approval and task records/);
});

test('testing guidance agrees on implementation-first and regression RED-GREEN exception', () => {
  for (const name of ['AGENTS.md', '.agents/workflows/feature-delivery.md',
    '.agents/workflows/spec-driven-delivery.md', '.agents/agents/tdd-guide.md',
    '.agents/agents/planner.md', '.agents/skills/flutter-testing/SKILL.md',
    '.github/agents/crew-builder.agent.md', '.github/prompts/flutter-test.prompt.md',
    '.github/prompts/plan.prompt.md']) {
    const text = normalize(read(name));
    assert.match(text, /implementation-first/i, name);
    assert.match(text, /bug regression.*RED-GREEN-REFACTOR/i, name);
    assert.doesNotMatch(text, /Tests first for business|TDD is expected|lightweight auto-baseline/i, name);
  }
  for (const name of ['AGENTS.md', '.agents/workflows/feature-delivery.md',
    '.agents/workflows/spec-driven-delivery.md', '.agents/skills/flutter-testing/SKILL.md',
    '.agents/agents/tdd-guide.md', '.github/agents/crew-builder.agent.md',
    '.github/prompts/flutter-test.prompt.md']) {
    const text = normalize(read(name));
    assert.match(text, /`bloc_test` only for BLoC\/Cubit/, name);
    assert.match(text, /`mocktail` only when mocks help/, name);
  }
});

test('Dart formatter is language-scoped and editor testing hints are conditional', () => {
  const settings = JSON.parse(read('.vscode/settings.json'));
  assert.equal(settings['editor.defaultFormatter'], undefined);
  assert.equal(settings['[dart]']['editor.defaultFormatter'], 'Dart-Code.dart-code');
  assert.equal(settings['[dart]']['editor.formatOnSave'], true);
  const hints = JSON.stringify(settings['github.copilot.chat.testGeneration.instructions']);
  assert.match(hints, /bloc_test only for BLoC\/Cubit/);
  assert.match(hints, /mocktail only when mocks help/);
  assert.doesNotMatch(hints, /Always write.*Mocktail\/bloc_test/);
  JSON.parse(read('.vscode/tasks.json'));
  JSON.parse(read('.vscode/extensions.json'));
});

test('performance guidance separates const, rebuilds, painting and retained list state', () => {
  const text = normalize(read('.agents/skills/flutter-performance/SKILL.md'));
  assert.match(text, /same const widget instance.*skip an unchanged parent update/);
  assert.match(text, /does not prevent rebuilds.*own state.*inherited dependency/);
  assert.doesNotMatch(text, /never rebuilt during frame updates|Provider \/ Riverpod:/);
  assert.match(text, /Provider \(package:provider\).*context\.select<UserNotifier, String>/);
  assert.match(text, /Riverpod.*ref\.watch\(userProvider\.select/);
  assert.match(text, /Keep default automatic keepalives unless profiling and state requirements/);
  assert.match(text, /addAutomaticKeepAlives: false.*only when offscreen item state/);
  assert.match(text, /discard input\/focus state/);
  assert.match(text, /RepaintBoundary.*does not prevent widget rebuilds/);
});

test('native adapters use host capabilities without model mandates or mandatory fleet fanout', () => {
  for (const name of [...list('.github/agents'), ...list('.agents/agents')]) {
    const text = read(name);
    assert.match(text, /^---\nname: [^\n]+\ndescription: [^\n]+/);
    assert.doesNotMatch(text, /^model:/m, name);
  }
  const lead = normalize(read('.github/agents/fluttercrew.agent.md'));
  assert.match(lead, /only relevant host-supported specialists/);
  assert.match(lead, /Do not invoke every role by default/);
  assert.match(lead, /If delegation is unavailable, perform honest sequential role passes/);
  assert.match(lead, /Never ask specialists to invoke each other/);
  const canonical = normalize(read('AGENTS.md'));
  assert.match(canonical, /NOT native agent registrations/);
  assert.match(canonical, /host-supported tools and model defaults/);
  for (const name of list('.github/prompts')) {
    assert.doesNotMatch(read(name), /\$PROMPT\b|^model:/m, name);
  }
});

test('README keeps direct-prompt onboarding and valid local documentation links', () => {
  const text = read('README.md');
  const dashboardAsset = 'assets/dashboard_walkthrough.webp';
  const dashboardUrl = `https://raw.githubusercontent.com/tadev999/flutter_crew/main/${dashboardAsset}`;
  assert.ok([...text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)]
    .some((match) => match[1] === dashboardUrl), 'Dashboard image must use an absolute URL for npm');
  assert.ok(fs.existsSync(path.join(root, dashboardAsset)), dashboardAsset);
  assert.match(normalize(text), /For implementation, include `FlutterCrew` in the request/);
  assert.match(normalize(text), /Advice, review-only and plan-only requests do not start a run/);
  assert.ok(text.includes('Firebase Auth and Firestore'));
  assert.ok(text.includes('Antigravity'));
  assert.ok(text.includes('FlutterCrew: Build a task manager'));
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

test('delivery docs distinguish enforced approval and recorded work from file heuristics', () => {
  for (const name of ['.agents/workflows/feature-delivery.md',
    '.agents/workflows/spec-driven-delivery.md']) {
    const text = read(name);
    assert.match(text, /spec revision/i);
    assert.match(text, /resume/);
    assert.match(text, /nextActions/);
    assert.match(text, /task REQ-001 implementation in_progress/);
    assert.match(text, /activity hints/);
  }
  const readme = read('README.md');
  assert.match(readme, /delivery workflow/i);
  assert.match(readme, /Spec-driven development/i);
  assert.doesNotMatch(read('README.md'), /cannot modify source code until|progresses monotonically/);
  assert.doesNotMatch(read('.agents/workflows/feature-delivery.md'), /approval timestamp \(Phase 3\)/);
});