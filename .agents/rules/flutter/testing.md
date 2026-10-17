# Flutter Testing Rules

## 1. Test Standards
- Write tests following the **Arrange - Act - Assert (AAA)** pattern.
- Mock all external interfaces using `mocktail` (preferred) or `mockito`.
- Target 80%+ test coverage for domain UseCases, Repositories, and State Notifiers/Blocs.

## 2. Unit & State Testing
- Use `bloc_test` for all BLoC and Cubit state transitions.
- Verify both happy path and failure cases (network error, validation errors).
- Assert exact emitted state sequences.

## 3. Widget Testing
- Test critical UI widgets with `testWidgets`.
- Wrap components in `MaterialApp` with minimal required scaffold and theme.
- Use `find.byKey(const Key('...'))` for reliable element identification.
- Ensure all asynchronous animations or timers settle with `await tester.pumpAndSettle()`.
