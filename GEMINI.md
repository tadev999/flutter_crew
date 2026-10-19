# Antigravity Workspace Directives — FlutterCrew System

This Flutter workspace is integrated with **FlutterCrew** (AI Coding Fleet & Quality Gates).

---
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

## ⚡ TRIGGER CONDITION: Keyword-Activated Workflow

The strict **FlutterCrew Delivery Pipeline** (Runtime start/resume, REQ-xxx baseline, Review & Approval gate, Traceability, Verification gates) is ONLY triggered when the user explicitly includes the keyword **`FlutterCrew`** (case-insensitive, e.g. `FlutterCrew`, `flutter_crew`, `fluttercrew`, or `/fluttercrew`) in their prompt.

### 1. When `FlutterCrew` keyword IS present:
Follow the 7-phase delivery pipeline:
1. **Intake & Brief (`planner`)**:
   - Check status first: `node .agents/runtime/crew.js status`
   - If previous run is completed (`status === 'done'`):
     - Archive it to preserve history: `node .agents/runtime/crew.js archive`
   - If no active run exists:
     - Detect backend from project (`firebase`, `supabase`, or `none`).
     - Save user prompt into `docs/fluttercrew/request.md`.
     - Initialize run: `node .agents/runtime/crew.js start docs/fluttercrew/request.md <backend>`
   - Immediately refresh visual dashboard: `node .agents/runtime/crew.js dashboard`

2. **Architecture & Spec (`architect`)**:
   - Baseline stable `REQ-xxx` IDs with clear Acceptance Criteria and MVVM data contracts (`spec.json`).

3. **Dev Approval Gate (`developer`)**:
   - Present proposed `REQ-xxx` IDs and Acceptance Criteria to the developer for review & approval.
   - Record approval via `node .agents/runtime/crew.js approve` before modifying application source files.
   - Never write application code without completing this gate.

4. **MVVM Implementation (`flutter-reviewer`)**:
   - Implement the feature directly using clean MVVM separation:
     - **Models**: Data classes, DTOs, API/backend Services.
     - **ViewModels**: State management holding UI state and business logic.
     - **Views**: Pure UI widgets reacting to ViewModel state. No business logic in Views.

5. **Unit & Widget Testing (`tdd-guide`)**:
   - Immediately after implementation, write and execute comprehensive Unit Tests (`test/features/...`) using `mocktail` and `bloc_test` to verify business logic and edge cases.

6. **Quality Gates (`crew.js runtime`)**:
   - Execute verification: `node .agents/runtime/crew.js verify` (`dart format`, `flutter analyze --fatal-infos`, and `flutter test`).

7. **Acceptance & Done (`fleet lead`)**:
   - Record review attestations and complete the delivery run: `node .agents/runtime/crew.js finish`.

**Live Workflow Stepper & Dashboard Link in Chat**:
At the beginning of your response, always display the pipeline status and a direct clickable link to the local Live Dashboard:
```text
[1. Intake] ➔ [2. Spec] ➔ [3. Dev Approval 👤] ➔ [4. Implementation] ➔ [5. Unit Testing] ➔ [6. Quality Gates] ➔ [7. Done]
📊 Dashboard: [Mở Live Dashboard](file://<path_to_project>/.fluttercrew/dashboard.html) (Tự động mở & cập nhật)
```
State the current active phase, specialist agent, and what runs next.

---

### 2. When `FlutterCrew` keyword IS NOT present:
- Act as a fast, agile, and helpful Flutter & Dart AI coding assistant.
- Provide direct answers, code changes in `lib/` or `test/`, and quick iterations.
- Do NOT invoke `node .agents/runtime/crew.js`, do NOT enforce REQ-xxx baseline or approval gates, and do NOT print the pipeline stepper.
- Still respect Flutter best practices and the **Immutable System Files** protection rule above.
