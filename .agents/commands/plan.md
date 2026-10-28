---
description: Plan a new Flutter feature or screen with feature-first BLoC architecture and Firebase or Supabase backend specifications.
---

# /plan Command

Invokes the **planner** and **architect** agents to produce a complete implementation blueprint for a Flutter feature.

## What This Command Does

1. Analyzes the requested feature requirements.
2. Designs the feature-first BLoC structure (`models/`, `services/`, `bloc/`, `views/`).
3. Defines the exact data contract for **Firebase** (collections, documents, security rules) or **Supabase** (PostgreSQL schema, foreign keys, RLS policies).
4. Outlines the TDD plan (what tests to write first).
5. Outputs an actionable, phased checklist.
6. Produces a structured spec matching `.agents/templates/spec.example.json`,
   following `.agents/workflows/spec-driven-delivery.md`: stable IDs, original
   source references, observable criteria and automated/manual verification.
   Tasks/tests are keyed to IDs. Review scope changes explicitly. Plan-only does
   not mean implementation complete; the delivery lead baselines the spec later.

## Usage

```text
User: /plan Create a real-time group chat feature using Supabase
```
