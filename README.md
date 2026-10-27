# FlutterCrew

[![Flutter](https://img.shields.io/badge/Flutter-3.x%2B-02569B?logo=flutter&logoColor=white)](https://flutter.dev)
[![Dart](https://img.shields.io/badge/Dart-3.x%2B-0175C2?logo=dart&logoColor=white)](https://dart.dev)
[![npm](https://img.shields.io/badge/npm-flutter--crew-CB3837?logo=npm&logoColor=white)](https://www.npmjs.com/package/flutter-crew)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

**Spec-driven Flutter delivery with Dashboard Runtime**

FlutterCrew adds an observable delivery workflow to your AI assistant. It breaks implementation requests into requirements (`REQ-xxx`), asks for developer approval before implementation, and records task progress and verification evidence on a local dashboard. Instructions guide the assistant; runtime gates validate recorded state and local checks, not every editor action.

---

## 🚀 Why FlutterCrew?

Raw AI assistants generate code inside a black box—deciding architecture unilaterally, silently faking missing backend configs, and triggering expensive late-stage rewrites.

**FlutterCrew makes delivery progress and evidence visible:**

| 🎰 Raw AI Black Box | 🛡️ The FlutterCrew Way |
|---|---|
| ❌ **Dumps code blindly** with zero requirement visibility | 📋 **Spec Breakdown**: Decomposes prompts into transparent `REQ-xxx` items with acceptance criteria |
| ❌ **Unilateral decisions** leading to painful rewrites | 👤 **Developer Approval Gate**: Review & approve the spec *before* any Dart code is touched |
| ❌ **Silent mock fallbacks** & ignored backend errors | 🚨 **Blocker Detection**: Automatically halts on missing Firebase/Supabase configs or RLS rules |
| ❌ **No progress tracking** across dozens of files | 📊 **Live Dashboard**: Real-time browser board tracking tasks from `pending` to `done` |
| ❌ **"Looks good to me"** code that fails in production | 🧪 **Automated Quality Gates**: Enforces `dart format`, `flutter analyze`, and unit/widget tests |

> 💡 Review the scope early to catch missing requirements before implementation. Time and token savings depend on the project; no fixed reduction is guaranteed.

### How it works

```text
[1. Intake]          💬 Prompt: "FlutterCrew: Add Firebase Google Sign-In"
      ↓
[2. Spec Breakdown]  📋 Generates REQ-001 (Auth Service) & REQ-002 (Login UI)
      ↓
[3. Dev Approval 👤] 🛑 You review & approve spec BEFORE any code is touched
      ↓
[4. Implementation]  🛠️ Implements Model, ViewModel, and View cleanly
      ↓
[5. Tests]           🧪 Auto-writes & runs tests mapped to each REQ-xxx
      ↓
[6. Quality Gates]   🛡️ Enforces `dart format` & `flutter analyze --fatal-infos`
      ↓
[7. Done]            🚀 Evidence saved, marked complete on Live Dashboard
```

---

## Dashboard

[![Animated demo of the current dashboard: developer approval, task progress, testing, verification, completion, stale evidence after source edits, and light theme. All data is simulated.](https://raw.githubusercontent.com/tadev999/flutter_crew/main/assets/dashboard_walkthrough.webp)](https://raw.githubusercontent.com/tadev999/flutter_crew/main/assets/dashboard_walkthrough.webp)

Run these commands from the Flutter project:

```bash
node .agents/runtime/crew.js dashboard --open
```

The dashboard summarizes requirements, tasks, workflow stage, verification, and review evidence. In headless environments, start the watcher with `node .agents/runtime/crew.js watch`.

## Requirements

- Node.js 18 or later
- Flutter and Dart SDK for Flutter projects
- A tool-capable AI assistant, such as VS Code Copilot or Antigravity

## Install

Create a new project:

```bash
npx flutter-crew init
```

Install workflows in an existing Flutter project:

```bash
npx flutter-crew
```

Run from a local FlutterCrew checkout:

```bash
node bin/cli.js /path/to/flutter_project
```

Uninstall from the Flutter project:

```bash
npx flutter-crew uninstall
```

Preview changes before installing:

```bash
npx flutter-crew install --dry-run
```

Installation records which files it owns and keeps recovery information separately
from delivery runs. Existing VS Code settings, tasks and extension recommendations
are preserved rather than blindly replaced or merged. Other conflicting files are
backed up before replacement. Review the install output and keep the installation
record with the project until uninstall is complete.

Uninstall restores tracked originals and removes only unchanged files owned by the
installation. Team-owned files, files edited after installation, delivery evidence
and unrelated backups are preserved. Conflicts are reported for manual review.
For older installations without an ownership record, uninstall refuses destructive
cleanup rather than guessing which files belong to FlutterCrew.

To update an existing installation, rerun `npx flutter-crew install`: unchanged
owned files can be updated while local edits and the original recovery backups
are retained. A partial uninstall reports remaining conflicts; keep the ownership
record and backups until those conflicts are resolved. Never delete backups to
make an uninstall look successful. For legacy installations, review the old
backups before reinstalling; a new ownership record cannot reconstruct a missing
pre-install original.
Privacy ignore rules and their ownership record also remain while delivery
evidence is present. Partial/no-manifest uninstall currently exits successfully
for compatibility; always read its retained-path notices rather than treating
exit code zero as proof that every installed file was removed.

Inspect available commands and diagnose your environment:

```bash
npx flutter-crew --help
npx flutter-crew --version
npx flutter-crew doctor
```

`doctor` performs local checks only. It does not deploy, connect to your backend,
approve a spec or start a delivery run. A missing SDK or configuration is reported
with a next step; a passing diagnosis is not evidence of backend authorization.

## Use

For implementation, include `FlutterCrew` in the request to activate delivery.
Advice, review-only and plan-only requests do not start a run, even if they mention
the product name. A requirements file is optional.

```text
FlutterCrew: Build a task manager with Firebase Auth and Firestore. Use Riverpod, owner-only access, and responsive layouts.
```

Choose the amount of process appropriate to the task:

| Approach | When to use | Behavior |
|---|---|---|
| Quick assistance | Questions, review or small direct edits without the keyword | Direct work with relevant checks; no runtime run |
| Standard delivery | A bounded implementation request with the keyword | Compact spec and focused implementation/tests, with all delivery gates retained |
| Full delivery | Larger, backend or multi-feature implementation with the keyword | Expanded acceptance criteria, vertical slices and review evidence |

These are workflow descriptions, **not CLI profile flags**. Standard delivery does
not bypass approval, traceability, format/analyze/test gates or applicable backend
authorization checks. Reuse the project's existing state management and test tools;
do not introduce BLoC, Riverpod or a mocking library merely to satisfy a template.

When blocked, inspect `status` or the dashboard for the cause and next command:

```bash
npx flutter-crew status
```

Preflight checks infer backend capabilities from source and local configuration:
Firebase Auth-only does not require Firestore resources, Firestore requires its
rules/indexes/converters, and Storage requires its own rules. Supabase Auth-only
does not require application-table migrations; database/RPC/Postgres realtime
requires RLS evidence, and Storage requires policies on `storage.objects`.
Unrecognized Supabase usage is checked conservatively as database usage.
These are static heuristics, not a Dart/SQL parser or proof of connectivity.
Wrappers, generated code or unusual layouts need explicit review; requirement
coverage and negative authorization tests remain part of delivery.

## IDE support

| Host | Entry point | Delegation |
|---|---|---|
| VS Code Copilot | Root/project instructions plus `.github/agents/` and `.github/prompts/` | Native custom agents when the host exposes them |
| Claude Code | `CLAUDE.md` referencing the shared workflow | Shared role guides can be executed sequentially; no claim of native registration |
| Gemini / Antigravity | `GEMINI.md` referencing the shared workflow | Explicit workflow loading when not auto-discovered; sequential fallback |
| Cursor | `.cursorrules` referencing the shared workflow | Host-dependent; sequential fallback |
| Other tool-capable assistants | Read `AGENTS.md` and the shared workflow explicitly | Sequential role passes unless native delegation is available |

`.agents/agents/` contains portable role guides, not a universal native-agent
registration format. Discovery depends on the host/version and workspace settings.
This repository tests customization contracts; it does not simulate each IDE or
guarantee that every host loads files automatically.

## Frequently Asked Questions

<details>
<summary><b>How is FlutterCrew different from raw Copilot, Cursor, or Claude Code?</b></summary>
<br>

FlutterCrew does not replace your AI assistant—it acts as an **engineering fleet orchestrator & quality gatekeeper**. While raw AI assistants generate code without boundaries or spec tracking, FlutterCrew enforces structured requirement breakdown (`REQ-xxx`), waits for your explicit approval before modifying code, detects blocked tasks, runs automated verifications, and gives you a visual dashboard.
</details>

<details>
<summary><b>Do I have to use FlutterCrew for every prompt?</b></summary>
<br>

No! Interact normally for rapid, ad-hoc coding or quick Q&A. Include `FlutterCrew` in an implementation request when you want delivery with specs, approval gates and verification evidence. Review, advice and plan-only requests remain read-only with respect to runtime runs even when they mention the keyword.
</details>

<details>
<summary><b>Which backends are supported?</b></summary>
<br>

FlutterCrew natively supports **Firebase** (Auth, Firestore, Security Rules, Storage) and **Supabase** (Auth, PostgreSQL Schema, RLS Policies, Realtime, Storage), as well as pure offline or client-only Flutter applications (`none`).
</details>

## Documentation

- [Delivery workflow](.agents/workflows/feature-delivery.md)
- [Spec-driven development](.agents/workflows/spec-driven-delivery.md)
- [Project instructions](AGENTS.md)

## Development and validation

```bash
npm run check
npm test
npm run test:flutter-smoke
```



## License

[MIT](LICENSE)
