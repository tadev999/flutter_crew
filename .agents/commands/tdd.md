---
description: Run implementation-first, immediately test-verified delivery for Flutter logic and UI.
---

# /tdd Command

Uses the **tdd-guide** role guide for implementation-first delivery.
The `/tdd` name is retained for compatibility; it does not select a test-first workflow.

## Actions Executed

1. Uses implementation-first for features and bug fixes: edit production code before
   writing or updating tests. Existing tests may be run unchanged during diagnosis.
2. Adds or updates tests, including regression coverage after the production fix,
   then executes them immediately; no test-first exception.
3. Resolves failures and refactors while keeping tests passing, without weakening
   assertions to accommodate faulty behavior.

## Usage

```text
User: /tdd Implement UserProfileBloc and AuthService
```
