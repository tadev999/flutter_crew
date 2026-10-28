---
description: Scaffold a brand new Flutter project with interactive choices for target OS platforms, backend (Firebase vs Supabase), and state management.
---

# /project-init Command

Invokes the **planner** and **architect** agents to initialize a new Flutter application with feature-first BLoC and selected backend infrastructure.

## Interactive Options Offered

1. **Target Platforms (OS)**:
   - Mobile: iOS, Android
   - Web: Web
   - Desktop: macOS, Windows, Linux
2. **Backend**:
   - **Supabase**: Configures `supabase_flutter`, generates `supabase/migrations/`, sets up RLS baseline, and `.env.example`.
   - **Firebase**: Configures `firebase_core`, `cloud_firestore`, `firebase_auth`, and generates Zero-Trust `firestore.rules`.
   - **None**: Standalone local application.
3. **State Management**:
   - **BLoC / Cubit** (default): Configures `flutter_bloc` and `bloc_test`.
   - **Riverpod**: Configures `flutter_riverpod`.
   - **Provider**: Configures `provider`.

## Usage Example

```text
User: /project-init Create a new app named 'fitness_tracker' for iOS and Android, using Supabase and BLoC
```
