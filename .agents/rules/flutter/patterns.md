# Flutter & Dart Architectural Pattern Rules

## 1. Clean Architecture Boundaries
- Features must be isolated into `lib/features/<feature>/` with `domain/`, `data/`, and `presentation/`.
- Domain layer must NEVER import Flutter UI packages (`package:flutter/*`) or third-party backend SDKs (`cloud_firestore`, `supabase_flutter`).
- Presentation layer only interacts with Domain UseCases or Repository interfaces.

## 2. Repository Pattern
- Define repository contracts as `abstract interface class FeatureRepository` in `domain/repositories/`.
- Concrete implementations belong in `data/repositories/` and depend on abstracted DataSources.
- Return functional `Either<Failure, T>` (or Result pattern) from repository methods to force explicit error handling.

## 3. State Management Patterns
- States must be modeled as Dart 3 `sealed class` hierarchies (e.g. `Initial`, `Loading`, `Success`, `Failure`).
- Avoid boolean soup (`bool isLoading = false; bool isError = false;`).
- Dispose all controllers, focus nodes, animations, and stream subscriptions inside `dispose()`.
