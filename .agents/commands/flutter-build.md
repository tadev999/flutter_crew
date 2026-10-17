---
description: Run flutter analyze, check pub dependencies, and invoke dart-build-resolver to fix issues surgically.
---

# /flutter-build Command

Invokes the **dart-build-resolver** agent to fix compiler errors, analyzer issues, and dependency problems.

## Actions Executed

1. Runs `flutter analyze 2>&1`.
2. Runs `dart run build_runner build --delete-conflicting-outputs` if applicable.
3. Groups errors by file and fixes them with minimal surgical edits.
4. Verifies resolution with clean analyzer status.

## Usage

```text
User: /flutter-build
```
