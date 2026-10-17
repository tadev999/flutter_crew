---
description: Run the Test-Driven Development workflow for Flutter logic and UI.
---

# /tdd Command

Invokes the **tdd-guide** agent to implement features or fix bugs following the Red-Green-Refactor cycle.

## Actions Executed

1. Writes failing tests first (`test/` or `blocTest`).
2. Implements the minimal production logic to turn tests green.
3. Refactors code for readability and efficiency while keeping tests passing.

## Usage

```text
User: /tdd Implement UserProfileUseCase and AuthBloc
```
