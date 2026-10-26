---
description: Generate comprehensive Flutter unit, bloc, and widget tests
---

Read AGENTS.md first for intent-first activation and safety. Advice, review-only
and plan-only never start or resume runtime delivery, even with a keyword.
For activated implementation follow .agents/workflows/feature-delivery.md;
otherwise provide quick direct assistance without starting runtime delivery.
Use .agents/agents/tdd-guide.md as a role guide, not native registration.
Generate comprehensive, robust tests for the specified Flutter/Dart code.

Guidelines:
1. **Testing Library**: Use existing `flutter_test`/`test`; `bloc_test` only for
   BLoC/Cubit and `mocktail` only when mocks help. Neither is mandatory for
   non-bloc or trivial tests. Default to implementation-first, immediately tested;
   for a bug regression use the RED-GREEN-REFACTOR exception before the fix.
2. **Structure**: Follow Arrange-Act-Assert (`// Arrange`, `// Act`, `// Assert`).
3. **Scenarios**:
   - Happy path / normal state transitions.
   - Failure path (network exceptions, unauthorized access, empty states).
   - Edge cases (null values, empty collections, rapid sequential inputs).
4. **Mocking**:
   - Create mock classes extending `Mock` and implementing contracts: `class MockUserRepository extends Mock implements UserRepository {}`.
   - Setup fallback values using `registerFallbackValue()` if needed.
   - Verify interactions using `verify(() => repository.method()).called(1)`.
5. **Widget Tests**:
   - Wrap widgets under test in `MaterialApp` and `Scaffold`.
   - Await async work; use bounded `pump()` for ongoing animations and
     `pumpAndSettle()` only when the tree is expected to settle.
   - Find widgets using `find.byType`, `find.text`, `find.byKey`.
