# Flutter_Crew — Flutter & Mobile Agent System

**Flutter_Crew** is a specialized, production-ready AI coding agent fleet tailored exclusively for **Flutter & Dart** application development, supporting the two premier mobile backend platforms: **Firebase** and **Supabase**. It is fully optimized for **VSCode** and modern AI coding assistants (GitHub Copilot, Claude Code, Cline, Roo Code, Cursor, Antigravity).

**Version:** 1.3.0

## Scope of System File Protection

The immutable-system-files rules apply ONLY when this workflow is
installed in a target Flutter application.

They do NOT apply when developing or maintaining the FlutterCrew
source repository itself. In that repository, agents may modify
runtime code, workflows, instructions, and tests as requested.

Never modify active run state or evidence directly; use runtime commands.

## 🛡️ IMMUTABLE SYSTEM FILES (Strict Protection)

**NEVER modify, delete, overwrite, or refactor FlutterCrew system files** during feature implementation or user requests:
- `.agents/**` (agents, skills, runtime scripts, workflows, commands)
- `.fluttercrew/**` (system state, evidence, traces — managed strictly by runtime commands)
- `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `.cursorrules`, `.vscode/**`
- `.github/agents/`, `.github/prompts/`, `.github/copilot-instructions.md`

---

## ⚡ Mandatory Delivery Contract & Trigger Condition

The strict **FlutterCrew Delivery Pipeline** (Runtime start/resume, REQ-xxx baseline, Review & Approval gate, Traceability, Verification gates) is ONLY triggered when the user explicitly includes the keyword **`FlutterCrew`** (case-insensitive, e.g. `FlutterCrew`, `flutter_crew`, `fluttercrew`, or `/fluttercrew`) in their prompt.

When `FlutterCrew` keyword is NOT present, act as a fast, direct, agile Flutter/Dart coding assistant without starting `crew.js` runtime runs, blocking on REQ approval, or printing pipeline steppers.

When `FlutterCrew` keyword IS present:
Accept direct natural-language prompts and optional documents equally. Follow
`.agents/workflows/input-intake.md`: the agent saves inline requests as an internal
source brief, preserving user wording and separating assumptions. Do not require
a file, specific filename or magic prompt when a substantive request is supplied.
Never overwrite an active run/brief to accept new input; use reviewed scope changes.

Delivery is **SDD-led, Implementation-first, and Test-verified**. Read
`.agents/workflows/spec-driven-delivery.md`. Baseline stable requirement IDs linked
to the original brief, then track each ID to code/test/executed evidence using
runtime `spec` and `trace`. No omitted/pending/blocked/stale ID may finish. Spec
revisions require a reviewed impact report and invalidate previous gates. Keep
specs minimal for small fixes; manual visual verification needs rationale and does
not replace automated tests for business/state/security behavior.

For app/feature implementation (not advice, review-only or plan-only requests),
read and execute `.agents/workflows/feature-delivery.md`. This contract takes
precedence over the illustrative workflow below. Use
`node .agents/runtime/crew.js status` to resume or `start <requirements.md>
<firebase|supabase|none>` to begin. Do not stop after planning or launching a UI.

- Implement the entire requested scope in working vertical slices; track each
   acceptance item and its tests. No silent omissions or runtime dummy fallback.
- Real backend access/configuration and negative authorization tests are required
   when a backend is requested. Missing access is BLOCKED, not DONE.
- Design a product-specific experience: visual hierarchy, accessible theme tokens,
   responsive layouts, meaningful copy, onboarding, deliberate micro-interactions
   and complete loading/empty/error/offline states. Respect reduced motion.
- Delegate relevant specialists only when supported; do not invoke all roles by
   default. Copilot adapters are in `.github/agents/`. The role guides in
   `.agents/agents/` are NOT a portable native-agent registration mechanism.
- In Antigravity, explicitly load the shared delivery workflow if it is not
   discovered. Use sequential role passes when native delegation is unavailable;
   disclose this rather than pretending multiple agents ran.
- Before completion run `verify`, record reviewed evidence with `accept`, then
   `finish` through the Node runtime. Source edits invalidate prior results.
- Never invent command/device results, measurements, screenshots or credentials.
   Cloud mutations/deployment require approval. Secrets stay out of chat/logs.
- Gates provide local checks and recorded attestations, not proof of perfect
   software, backend connectivity, full privacy compliance or production readiness.

---

## 1. Core Principles

1. **Flutter & Dart Idiomatic First**: Adhere strictly to Effective Dart guidelines. Fully leverage Dart 3 features (sealed classes, pattern matching, records), enforce `const` constructors, and maintain immutable state.
2. **MVVM Architecture Boundaries**: Enforce clean separation across three layers: **Model** (Data classes, DTOs, API/backend Services & Repositories), **ViewModel** (State management via BLoC/Cubit, Riverpod Notifiers, or ChangeNotifier holding UI state & business logic), and **View** (Pure Flutter widgets observing ViewModel state). Never leak business logic into Views.
3. **Backend-Agnostic Core with Dedicated Adapters**: Decouple business logic from backend infrastructure. Seamlessly support, swap, or combine **Firebase** and **Supabase**.
4. **Security-First (Zero Trust Mobile & Backend)**:
   - **Client**: Never hardcode API secrets or service account keys in source code; store sensitive tokens via `flutter_secure_storage`.
   - **Backend**: All data must be guarded by **Firebase Security Rules** (Firestore/Storage) or **Supabase Row Level Security (RLS)** on PostgreSQL.
5. **Implementation-First & Test Verification Loop**: Directly implement MVVM slices (Models, Services, ViewModels, Views), then write unit tests for ViewModels/Services, state tests (`bloc_test`, test providers), and widget tests for critical UI paths. Target 80%+ test coverage for core business logic.
6. **Performance-Aware UI**: Eliminate wasteful widget rebuilds (decompose widgets into small classes, enforce `const`, `select`, `listenWhen`, `buildWhen`, `RepaintBoundary`), and handle large scrollable lists efficiently.

---

## 2. Specialized Agents

| Agent | File Path | Role & Purpose | When to Use |
|---|---|---|---|
| **planner** | `.agents/agents/planner.md` | Feature architecture planning, UI wireframes, Firebase/Supabase data contracts | Starting new features, major refactorings |
| **architect** | `.agents/agents/architect.md` | System design, State Management selection (BLoC/Riverpod), MVVM Architecture, DI | Establishing architecture, directory conventions |
| **flutter-reviewer** | `.agents/agents/flutter-reviewer.md` | Code review for Flutter & Dart, widget lifecycle, rebuild optimization, accessibility (a11y) | After writing or modifying Flutter/Dart code |
| **dart-build-resolver** | `.agents/agents/dart-build-resolver.md` | Diagnose and fix `flutter analyze`, compilation errors, `pubspec.yaml` conflicts, `build_runner` | When build or analysis fails |
| **firebase-specialist** | `.agents/agents/firebase-specialist.md` | Firebase expert (Auth, Firestore data modeling, Firestore/Storage Security Rules, Functions) | Integrating or optimizing Firebase backend |
| **supabase-specialist** | `.agents/agents/supabase-specialist.md` | Supabase expert (PostgreSQL schema, RLS Policies, Supabase Auth, Realtime, Edge Functions) | Integrating or optimizing Supabase backend |
| **database-reviewer** | `.agents/agents/database-reviewer.md` | Review data models, indexes, query performance, and table/collection security | Creating schemas, migrations, or security rules |
| **tdd-guide** | `.agents/agents/tdd-guide.md` | Test-Driven Development guide, unit tests, bloc tests, widget tests using Mocktail | Writing new logic, bug fixing, regression tests |
| **security-reviewer** | `.agents/agents/security-reviewer.md` | Audit mobile vulnerabilities (SSL pinning, secure storage, deep links) and backend rules (RLS) | Pre-commit audits, periodic security checks |
| **performance-optimizer** | `.agents/agents/performance-optimizer.md` | FPS optimization, DevTools Profiler, memory leak prevention, app bundle size reduction | Laggy UI (jank), high RAM usage, slow startup |
| **refactor-cleaner** | `.agents/agents/refactor-cleaner.md` | Dead code cleanup, import normalization, complex widget simplification | Technical debt cleanup, codebase maintenance |
| **doc-updater** | `.agents/agents/doc-updater.md` | Technical documentation, Architecture Decision Records (ADRs), schema codemaps | Post-feature completion, schema updates |

---

## 3. Skills Directory Map

Detailed skills are located in the `.agents/skills/` directory:
- `.agents/skills/flutter-mvvm-architecture/`: Production MVVM Architecture implementation in Flutter.
- `.agents/skills/flutter-state-management/`: Standard patterns for BLoC/Cubit, Riverpod 2.x, and Provider.
- `.agents/skills/flutter-core-patterns/`: Widget decomposition, Forms & Validation, theming, responsive layout.
- `.agents/skills/flutter-routing/`: Modern navigation with `go_router`, route guards, deep links.
- `.agents/skills/flutter-testing/`: TDD methodology, Unit/Widget/Integration testing with Mocktail & golden tests.
- `.agents/skills/flutter-performance/`: Smooth 60/120fps techniques, lazy loading, image caching, isolates.
- `.agents/skills/flutter-security/`: Encrypted storage, API protection, `--dart-define` configuration.
- `.agents/skills/flutter-build-ops/`: Pub dependency management, `build_runner`, CI/CD build scripts.
- `.agents/skills/firebase-integration/`: Firestore modeling, Security Rules authorization, Firebase Auth & Storage.
- `.agents/skills/supabase-integration/`: PostgreSQL schema, RLS Policies, Realtime streams, Supabase Auth & Storage.

---

## 4. Standard Workflow

```
[ Feature Request / Idea ]
            │
            ▼
   /plan  (planner & architect)
            │  - Analyze User Stories & Wireframes
            │  - Propose REQ-IDs & Acceptance Criteria
            │  - Design Schema: Firebase or Supabase
            ▼
[ User Review & Approval ]  <─── (Confirm requirements scope for new features)
            │
            ▼
[ MVVM Implementation ]
            │  - Implement Models & Services (Firebase / Supabase)
            │  - Implement ViewModels (Cubit / Bloc / ChangeNotifier)
            │  - Implement Views (Pages & Widgets)
            ▼
   /flutter-test  (test-guide)
            │  - Write Unit Tests for ViewModels & Services
            │  - Run `flutter test` to verify behavior & edge cases
            ▼
/flutter-build (dart-build-resolver)
            │  - Run `flutter analyze` & `build_runner`
            │  - Surgically resolve any compilation/linter errors
            ▼
/flutter-review & /backend-review
            │  - Verify MVVM & Rebuild boundaries
            │  - Audit RLS Policies / Firestore Security Rules
            ▼
   [ Complete / Ready to Commit ]
```

---

## 5. Commit & Release Standards

Follow Conventional Commits:
- `feat(auth)`: Integrate Supabase Auth OTP login
- `feat(chat)`: Stream realtime messages via Firebase Firestore
- `fix(profile)`: Resolve unnecessary widget rebuilds during avatar update
- `test(order)`: Add bloc_test suite for CartBloc
- `security(rules)`: Enable RLS on orders and profiles tables
- `perf(list)`: Wrap RepaintBoundary and migrate to ListView.builder
