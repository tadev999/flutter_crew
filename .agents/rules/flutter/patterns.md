# Flutter & Dart Architectural Pattern Rules

## 1. Architecture: feature-first BLoC or the project's existing pattern
- If the target app already has an established architecture or state management (Riverpod, Provider, ...), follow it consistently; do not introduce a new layering scheme.
- Otherwise use feature-first BLoC: `lib/features/<feature>/` with `models/`, `services/`, `bloc/`, `views/` (see the `flutter-bloc-architecture` skill).
- `models/`: immutable entities/DTOs with validated `fromJson`/`toJson`; no Flutter UI imports.
- `services/`: backend, storage and API access behind small interfaces injected by constructor.
- `bloc/`: Bloc/Cubit with sealed states (and events for Bloc); business logic only, no `BuildContext`, widgets or `dart:ui`.
- `views/`: widgets only; render state with `BlocBuilder`/`BlocSelector`, side effects with `BlocListener`, and forward user actions to the Bloc/Cubit.

## 2. Services and error handling
- Views never call services or backend SDKs directly; Blocs/Cubits depend on service interfaces, not concrete classes.
- Map backend exceptions to typed failures (e.g. a sealed `Failure`) or the project's existing error type; never swallow errors.
- Do not add use-case, repository or data-source layers unless the project already uses them.

## 3. State Management Patterns
- States must be modeled as Dart 3 `sealed class` hierarchies (e.g. `Initial`, `Loading`, `Success`, `Failure`).
- Avoid boolean soup (`bool isLoading = false; bool isError = false;`).
- Dispose all controllers, focus nodes, animations, and stream subscriptions inside `dispose()`.
