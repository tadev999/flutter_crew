---
name: flutter-build-ops
description: Flutter build automation, dependency resolution, build_runner code generation, and CI/CD workflow practices.
---

# Flutter Build & Ops Skill

This skill guides you through maintaining smooth builds, resolving pub dependencies, and running code generators.

## 1. Dependency Management (`pubspec.yaml`)

- Always specify semantic version bounds (e.g. `^2.4.0`) rather than `any`.
- Separate runtime dependencies from development tools (`dev_dependencies`).
- Run `flutter pub outdated` to check for major breaking updates before bumping.

## 2. Code Generation (`build_runner`)

For packages like `freezed`, `json_serializable`, and `riverpod_generator`:

```bash
# One-time build (deleting outdated generated outputs):
dart run build_runner build --delete-conflicting-outputs

# Continuous watch during development:
dart run build_runner watch --delete-conflicting-outputs

# If build_runner caches become corrupted:
flutter clean
flutter pub get
dart run build_runner build --delete-conflicting-outputs
```

## 3. Analysis Configuration (`analysis_options.yaml`)

Recommended strict lint configuration:
```yaml
include: package:flutter_lints/flutter.yaml

analyzer:
  language:
    strict-casts: true
    strict-inference: true
    strict-raw-types: true
  errors:
    missing_required_param: error
    missing_return: error
    todo: ignore

linter:
  rules:
    - prefer_const_constructors
    - prefer_const_declarations
    - prefer_final_locals
    - unawaited_futures
    - avoid_print
    - close_sinks
```
