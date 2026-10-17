---
description: Deliver a Flutter app from a direct prompt or optional document with backend, UX and verification gates
---

Read AGENTS.md and .agents/workflows/feature-delivery.md. Execute the complete
delivery protocol for a direct prompt, optional document, or existing run. Follow
.agents/workflows/input-intake.md: save an inline request as a source brief yourself,
separate assumptions, and do not require a document or fixed prompt format. Preserve
active run state; new scope needs change review, not a reset or overwritten brief.
Use the shared Node runtime to track status and verification. If this IDE supports
custom subagents, delegate relevant specialists; otherwise execute role passes
sequentially and say so. Do not assume .agents/agents registers native agents.
Do not enable automatic deployment or bypass approvals. Missing backend access
is a blocker, never permission to substitute runtime dummy data.