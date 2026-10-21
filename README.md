# FlutterCrew

[![Flutter](https://img.shields.io/badge/Flutter-3.x%2B-02569B?logo=flutter&logoColor=white)](https://flutter.dev)
[![Dart](https://img.shields.io/badge/Dart-3.x%2B-0175C2?logo=dart&logoColor=white)](https://dart.dev)
[![npm](https://img.shields.io/badge/npm-flutter--crew-CB3837?logo=npm&logoColor=white)](https://www.npmjs.com/package/flutter-crew)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

**Spec-driven Flutter delivery with Dashboard Runtime**

FlutterCrew turns unpredictable AI coding into a deterministic engineering pipeline. Instead of letting AI blindly generate code inside a black box, FlutterCrew decomposes requests into granular requirements (`REQ-xxx`, `REQ-yyy`, `REQ-zzz`), enforces a developer approval gate before writing code, and tracks every task live on a local dashboard.

---

## 🚀 Why FlutterCrew?

Raw AI assistants generate code inside a black box—deciding architecture unilaterally, silently faking missing backend configs, and triggering expensive late-stage rewrites.

**FlutterCrew turns AI chaos into an observable, deterministic pipeline:**

| 🎰 Raw AI Black Box | 🛡️ The FlutterCrew Way |
|---|---|
| ❌ **Dumps code blindly** with zero requirement visibility | 📋 **Spec Breakdown**: Decomposes prompts into transparent `REQ-xxx` items with acceptance criteria |
| ❌ **Unilateral decisions** leading to painful rewrites | 👤 **Developer Approval Gate**: Review & approve the spec *before* any Dart code is touched |
| ❌ **Silent mock fallbacks** & ignored backend errors | 🚨 **Blocker Detection**: Automatically halts on missing Firebase/Supabase configs or RLS rules |
| ❌ **No progress tracking** across dozens of files | 📊 **Live Dashboard**: Real-time browser board tracking tasks from `pending` to `done` |
| ❌ **"Looks good to me"** code that fails in production | 🧪 **Automated Quality Gates**: Enforces `dart format`, `flutter analyze`, and unit/widget tests |

> 💡 **The Pre-Flight Advantage**: Catching an architectural flaw or missing requirement during the **Spec Approval** gate saves up to **90% of token usage and debugging time** compared to late-stage refactoring.

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

Existing files are backed up before replacement. Configuration is not merged; uninstall restores available backups.

## Use

Include `FlutterCrew` in the request to activate the full delivery workflow.

```text
FlutterCrew: Build a task manager with Firebase Auth and Firestore. Use Riverpod, owner-only access, and responsive layouts.
```

## Dashboard

![FlutterCrew Live Dashboard Walkthrough](https://raw.githubusercontent.com/tadev999/flutter_crew/main/assets/dashboard_walkthrough.webp)

Run these commands from the Flutter project:

```bash
node .agents/runtime/crew.js dashboard --open
```

The dashboard summarizes requirements, tasks, workflow stage, verification, and review evidence. In headless environments, start the watcher with `node .agents/runtime/crew.js watch`.

## Frequently Asked Questions

<details>
<summary><b>How is FlutterCrew different from raw Copilot, Cursor, or Claude Code?</b></summary>
<br>

FlutterCrew does not replace your AI assistant—it acts as an **engineering fleet orchestrator & quality gatekeeper**. While raw AI assistants generate code without boundaries or spec tracking, FlutterCrew enforces structured requirement breakdown (`REQ-xxx`), waits for your explicit approval before modifying code, detects blocked tasks, runs automated verifications, and gives you a visual dashboard.
</details>

<details>
<summary><b>Do I have to use FlutterCrew for every prompt?</b></summary>
<br>

No! FlutterCrew is **keyword-activated**. When you want rapid, ad-hoc coding or quick Q&A, interact normally without the keyword. Include `FlutterCrew` in your prompt only when you want the full delivery pipeline with specs, approval gates, and verified deliverables.
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

## License

[MIT](LICENSE)
