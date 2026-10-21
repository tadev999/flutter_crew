# FlutterCrew

[![Flutter](https://img.shields.io/badge/Flutter-3.x%2B-02569B?logo=flutter&logoColor=white)](https://flutter.dev)
[![Dart](https://img.shields.io/badge/Dart-3.x%2B-0175C2?logo=dart&logoColor=white)](https://dart.dev)
[![npm](https://img.shields.io/badge/npm-flutter--crew-CB3837?logo=npm&logoColor=white)](https://www.npmjs.com/package/flutter-crew)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

**Spec-driven Flutter delivery for Firebase and Supabase.**

FlutterCrew installs AI agent workflows and a local runtime for tracking requirements, implementation, tests, reviews, and verification evidence.

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

## Documentation

- [Delivery workflow](.agents/workflows/feature-delivery.md)
- [Spec-driven development](.agents/workflows/spec-driven-delivery.md)
- [Project instructions](AGENTS.md)

## License

[MIT](LICENSE)
