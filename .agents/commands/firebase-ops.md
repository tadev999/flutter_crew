---
description: Manage Firebase operations, validate and test Firestore and Storage security rules, and generate type-safe models.
---

# /firebase-ops Command

Invokes the **firebase-specialist** and **database-reviewer** agents.

## Actions Executed

1. Audits `firestore.rules` and `storage.rules`.
2. Verifies Firestore document schemas and index requirements (`firestore.indexes.json`).
3. Generates or reviews `withConverter<T>` DataSource implementations.

## Usage

```text
User: /firebase-ops Review my firestore.rules for secure multi-tenant isolation
```
