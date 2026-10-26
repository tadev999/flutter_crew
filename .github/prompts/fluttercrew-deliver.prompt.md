---
description: "Build or resume a complete Flutter app from a direct prompt or optional requirements document with real backend and evidence-based delivery"
agent: FlutterCrew
---

Read AGENTS.md first: advice, review-only and plan-only never start or resume
runtime delivery, even with a keyword or selected delivery entrypoint.
For explicit implementation delivery follow .agents/workflows/input-intake.md, then execute
.agents/workflows/feature-delivery.md. Accept the user's direct prompt, an optional
document, or both. For a substantive inline request, save the source brief yourself;
do not ask for a requirements file or require a special filename/prompt format.
If no meaningful task/source/context is supplied, ask what to build.
Resume .fluttercrew/run.json when present without resetting it or overwriting its
brief; treat new scope as a reviewed spec revision. Do not stop after
planning or UI launch, use dummy backend fallbacks, fabricate verification, or
deploy without approval. The shared workflow owns proportional standard/full scope
and verify → accept reviewed evidence → finish ordering. Never hand-edit active
state or recorded evidence. Return a concise DONE/BLOCKED report with evidence.