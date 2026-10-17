---
description: Perform a deep review of Flutter/Dart code for architecture, widget lifecycle, performance, and Dart idioms.
---

# /flutter-review Command

Invokes the **flutter-reviewer** agent to perform an audit of recent changes or specified files.

## Actions Executed

1. Checks layer boundaries (Domain purity, DI).
2. Audits widget trees for unnecessary rebuilds and missing `const`.
3. Verifies controller/stream lifecycle disposals.
4. Checks null-safety idioms and error handling.
5. Reports findings classified by Critical, Warning, and Suggestion.

## Usage

```text
User: /flutter-review lib/features/feed/
```
