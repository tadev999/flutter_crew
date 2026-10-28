---
description: Simplify complex Flutter widgets, clean unused code, and improve architecture.
---

# /refactor Command

Invokes the **refactor-cleaner** and **flutter-reviewer** agents.

## Actions Executed

1. Breaks down large widget classes into small, const-friendly components.
2. Removes dead code and unused imports.
3. Modernizes Dart code with pattern matching and sealed classes.
4. Verifies tests still pass.

## Usage

```text
User: /refactor Simplify lib/features/dashboard/views/pages/dashboard_page.dart
```
