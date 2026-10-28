---
description: Initialize a new Flutter application from scratch with custom OS platforms and Firebase or Supabase backend
---

Read AGENTS.md first for intent-first activation and safety. Advice, review-only
and plan-only never start or resume runtime delivery, even with a keyword.
For activated implementation follow .agents/workflows/feature-delivery.md and
.agents/workflows/input-intake.md: accept direct prompts or optional documents,
capture a new brief safely and never overwrite/reset an existing run or brief.
Otherwise provide quick direct assistance without starting runtime delivery.
Never invent backend config or secrets; cloud mutations/deployment need approval.
Initialize and scaffold a new Flutter project tailored to the user's requirements.

Use the user's current request and supplied context; do not require a special variable.

Follow this workflow:
1. **Clarify or Extract Choices**:
   - Project Name (e.g. `ecommerce_app`)
   - Target Platforms (iOS, Android, Web, macOS, Windows, Linux)
   - Backend: **Firebase** vs **Supabase**
   - State Management: **BLoC** (default) vs **Riverpod**
2. **Scaffold Project**:
   - Provide or execute `flutter create --platforms=<platforms> <name>`
   - Add necessary dependencies (`pubspec.yaml`)
   - Generate feature-first BLoC folders: `core/`, `features/home/models/`,
     `features/home/services/`, `features/home/bloc/`, `features/home/views/`.
   - Setup initial backend config:
     - For Supabase: `.env.example`, Supabase client initialization in `main.dart`, initial SQL migration with RLS enabled.
     - For Firebase: Initial `firestore.rules`, Firebase initialization in `main.dart`.
3. **Verify**: Run `flutter analyze` to ensure zero compilation or dependency errors.
