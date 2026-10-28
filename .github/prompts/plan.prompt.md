---
description: Plan a new Flutter feature with feature-first BLoC and Firebase or Supabase backend
---

Read AGENTS.md and .agents/workflows/feature-delivery.md for the shared contract.
This is plan-only: advice, review-only and plan-only never start or resume runtime
delivery, even with a keyword. Do not mutate active state or claim implementation.
Use .agents/agents/planner.md and architect.md as role guides, not native registrations.
Plan the implementation of the requested feature with precision and production readiness.

Follow .agents/workflows/spec-driven-delivery.md. Return a lightweight structured
spec matching .agents/templates/spec.example.json: stable IDs, a feature slug,
original-brief references, Given/When/Then acceptance criteria and
automated/manual verification. Read docs/features/ first when it exists.
Map each implementation task and proposed test to its ID. Identify changes to
existing spec scope and their impact; never silently omit requested features.
For plan-only requests do not execute delivery gates or claim implementation done.
The delivery lead baselines the reviewed spec before implementation.

Follow these steps:
1. **Feature Requirements & User Stories**: Outline core user flows, edge cases, and failure modes.
2. **Architecture Blueprint** (feature-first BLoC, or the project's existing architecture if one is established):
   - Views: Pages, widgets, dialogs (`BlocBuilder`/`BlocListener`).
   - Bloc/Cubit: Events, sealed states and business logic.
   - Services: Backend, storage and API access behind injected interfaces.
   - Models: Immutable entities and DTOs with validated serialization.
3. **Backend Specification**:
   - If **Firebase**: Firestore collections/documents structure, Security Rules (`firestore.rules`), Index requirements, Auth providers.
   - If **Supabase**: PostgreSQL schema (tables, columns, types, foreign keys), Row Level Security (RLS) policies, Realtime requirements.
4. **Step-by-Step Implementation Checklist**:
   - Ordered list of files to create/modify.
   - Implementation-first for features and bug fixes: edit production code before
     writing or updating tests, then immediately execute them. Add regression
     coverage after the production fix; no test-first exception.
   - Verification commands (`flutter test`, `flutter analyze`).

Use the user's current request and supplied context; do not require a special variable.
