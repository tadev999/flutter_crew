# Spec-driven delivery, TDD-backed

Use SDD to define scope and completion; TDD to protect behavior; integration tests
to prove real system interactions. This protocol extends feature-delivery.md.
Do not add extra agents merely to produce more documents.

## 1. Scale the spec to the change

- Accept direct prompts or optional documents using input-intake.md. For inline
  input the agent captures the brief; the developer need not author Markdown/JSON.
- Small bug or UI adjustment: one brief paragraph, one or a few requirement IDs and
  an appropriate regression/visual verification. No elaborate architecture dossier.
- New feature/app: numbered requirements, journeys, boundaries, permissions,
  observable acceptance criteria, data contracts, UX states and implementation plan.
- Review against the ENTIRE original brief. Runtime cannot infer natural-language
  omissions or prove that an intentionally weakened spec still matches user intent.
- Resolve scope/privacy/backend ambiguities before baselining. Ask the user only
  for actual blockers; document reversible assumptions.

## 2. Baseline a machine-readable spec

Write a project document such as docs/spec.json using
.agents/templates/spec.example.json. Keep the source Markdown brief as-is.
Each requirement has:

- Stable ID (REQ-001, BUG-001, etc.). Do not renumber/reuse IDs to conceal changes.
- description and source reference to the actual brief/section/paragraph.
- Non-empty acceptanceCriteria: observable success, failure and relevant edge cases.
- verification: automated for business rules, authorization, state and regressions;
  manual may be appropriate for narrowly visual/copy/layout requirements.

Run `node .agents/runtime/crew.js spec docs/spec.json` after review. It records
the exact spec/brief hashes. An empty/duplicate/malformed spec is rejected.
Existing v1 runs remain readable but cannot verify/finish without a spec baseline;
baselining upgrades state to schema v2 and clears old gates/attestations.

The runtime requires references, not semantic proof. A reviewer must ensure source
references really map to the brief; file existence alone is not coverage.

## 3. Implement and trace each requirement

Plan tasks by requirement ID and vertical slice, then implement with selective TDD:
business logic/state/security/regression => failing test, implementation, refactor.
Use widget/golden/integration tests where appropriate. Do not force TDD ceremony
for every color/spacing change; do not use manual verification to evade logic tests.

Write one JSON trace report per ID using .agents/templates/trace.example.json.
Run `node .agents/runtime/crew.js trace REQ-001 .fluttercrew/traces/REQ-001.json`.
Statuses are pending, blocked or passed; skipped/waived is not completion.
The runtime also computes stale when a recorded trace or its inputs/evidence no
longer match; refresh the actual review/results and re-record that ID to clear it.

For passed, the report MUST list:

- implementation: non-empty array of actual project-relative implementation files.
- tests: actual test files; automated requirements need at least one. A manual
  requirement may have an empty array ONLY with non-empty testRationale explaining
  why manual verification is appropriate and what was actually observed.
- evidence: non-empty array of executed-result/review reports or logs. Record
  acceptance coverage, commands, target, actual outcomes and unresolved failures.

All referenced files must exist inside the project and be non-empty. The brief,
spec, trace report itself and run state do not count as implementation/test proof.
Report/hash integrity does not prove a referenced file is really a test or that a
test executed; reviewers must check this. Do not mark passed for unexecuted steps.
For pending/blocked, supply explanatory notes and the next safe action.

Finalize implementation/test links before the last review pass. Snapshot includes
linked source/test files outside normal source roots; adding a new such link may
invalidate earlier traces. Source changes conservatively invalidate ALL existing
traces and global attestations, not just IDs that appear affected.

## 4. Change control

Any spec/brief edit blocks verification/completion until rebaselined. For revisions
write a separate scope/impact report and run
`node .agents/runtime/crew.js spec docs/spec.json docs/spec-change.md`.
The report must document changed/added/removed IDs, why, affected code/tests/data,
risks and re-verification steps. Obtain user agreement for removed/deferred scope;
record that decision honestly, never imply a file proves authorization by itself.
Keep IDs stable. Retain old baseline metadata in run history; git preserves spec
contents. Rebaseline clears ALL traces, verification and global attestations, even
for apparently unaffected IDs, to avoid silently reusing stale claims.

## 5. Review and close

`status` lists spec issues and each requirement's pending/blocked/passed/stale state.
Independently check the brief-to-spec completeness, then ID-to-code/test/evidence
coverage. A generic backend report cannot substitute for an omitted requirement.
Run verify and review current traces, register the five global attestations, then
finish. Finish requires EVERY specified ID passed with current, unchanged files
in addition to the existing mechanical/backend/global gates.
DONE is local delivery status, not production certification or proof of perfect
coverage. Never alter scope, lower tests or falsify evidence to make gates pass.