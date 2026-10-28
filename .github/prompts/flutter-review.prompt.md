---
description: Perform a comprehensive code review on Flutter and Dart code
---

Read AGENTS.md and .agents/workflows/feature-delivery.md for the shared contract.
This is review-only: advice, review-only and plan-only never start or resume
runtime delivery, even with a keyword. Do not edit files or mutate run state.
Use .agents/agents/flutter-reviewer.md as a role guide, not native registration.
Review the current file or recent changes against Flutter, Dart, and BLoC best practices
(or the project's existing architecture).

Evaluate:
1. **Architecture & Boundaries**:
   - Are business logic and network calls separated from `build()` methods?
   - Do models and Blocs/Cubits stay free of widgets, `BuildContext` and `dart:ui`?
   - Are dependencies injected rather than instantiated inline?
2. **Widget Performance & Rebuilds**:
   - Are `const` constructors used wherever possible?
   - Are widget trees modularized into small `StatelessWidget` classes instead of large methods returning widgets?
   - Are state selectors or `listenWhen`/`buildWhen` used to prevent wasteful rebuilds?
   - Are controllers, streams, and timers properly disposed in `dispose()`?
3. **Dart Idioms & Null Safety**:
   - Are there unsafe force-unwraps (`!`)?
   - Is pattern matching or switch expression used idiomatic for state unions?
   - Are collections and models immutable with `copyWith`?
4. **Backend Security & Safety**:
   - Are API keys or secrets exposed?
   - Are Firestore or Supabase errors handled gracefully with user-friendly error states?

Provide actionable feedback formatted by file and severity (CRITICAL, WARNING, SUGGESTION) with concrete before/after code blocks.
