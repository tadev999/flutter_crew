# Flutter & Dart Coding Style Rules

## 1. Code Formatting
- Always run `dart format .` before committing code. Line length limit is 80 characters.
- Add trailing commas to all multi-line parameter lists, argument lists, and widget trees.

## 2. Immutability
- Declare variables as `final` by default.
- Use `const` constructors on every widget whose parameters are compile-time constants.
- State classes must be `@immutable` and provide `copyWith()`.

## 3. Naming Conventions
- `UpperCamelCase` for classes, enums, typedefs, extensions.
- `lowerCamelCase` for variable names, functions, named parameters.
- `lowercase_with_underscores` for file names and asset identifiers.
- Prefix private library members with `_`.

## 4. Null Safety
- Do not use the force unwrap operator `!` unless logically guaranteed non-null and crashing is intentional.
- Prefer `?.`, `??`, or Dart 3 pattern matching `switch (val) { ... }`.
- Avoid `late` keyword unless initialization is guaranteed in `initState()`.

## 5. Clean Widget Tree
- Keep `build()` methods concise (<80 lines). Extract sub-sections into private `StatelessWidget` classes.
- Avoid helper functions like `Widget _buildRow()` because they disable element subtree caching.
