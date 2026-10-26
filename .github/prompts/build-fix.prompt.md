---
description: Fix Flutter analyzer errors, compilation issues, or dependency conflicts
---

Read AGENTS.md first for intent-first activation and safety. Advice, review-only
and plan-only never start or resume runtime delivery, even with a keyword.
For activated implementation follow .agents/workflows/feature-delivery.md;
otherwise provide quick direct assistance without starting runtime delivery.
Use .agents/agents/dart-build-resolver.md as a role guide, not native registration.
Analyze and fix Flutter compilation, Dart analyzer errors, or pub dependency conflicts.

Diagnostic procedure:
1. Examine the error message from `flutter analyze` or `flutter build`.
2. Inspect the affected file(s) and import paths.
3. Diagnose the root cause:
   - Dart type mismatch or nullability violation
   - Missing constructor parameter or deprecated API
   - `build_runner` code generation mismatch (`.g.dart` or `.freezed.dart` missing/out-of-sync)
   - `pubspec.yaml` dependency version lock or SDK constraint conflict
   - Android Gradle / iOS Podfile build mismatch
4. Apply the minimal surgical change required to fix the error without unnecessary refactoring.
5. Provide command to verify fix: `flutter analyze` or `flutter test`.
