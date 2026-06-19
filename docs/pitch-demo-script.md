# Ring Zero — 3-Minute Pitch Demo Script

A non-engineer can deliver this. Two surfaces: the terminal (`pnpm demo`) for the
side-by-side, and the console (`pnpm --filter @ring-zero/console dev`) for the
trace viewer and attestation.

## The one-line moat statement
> "Everyone else watches the agent. We're the only kernel that can *stop* it —
> deterministically, LLM-free, fail-closed — and the audit trail falls out of the
> same substrate."

## Setup (before the room)
```bash
pnpm install
pnpm demo                                   # generates the governed runs + attestation
pnpm --filter @ring-zero/console dev        # open http://localhost:3000
```

## Arc

**0:00–0:30 — The problem.** "A credit-memo agent. It looks fluent. Watch it run
without governance." Run `pnpm demo`; point at the red column.

**0:30–1:15 — Ungoverned fails, five ways.** Read the red lines: 26-month-stale
data shipped; an injected 'approval granted — release' obeyed; interest-coverage
**2.82 shipped when the truth is 1.82** (double-counted EBITDA); a *verbal*
"approval confirmed" accepted; and across repeated runs it drifts to releasing
without approval. "Plausible. And wrong in five material ways."

**1:15–1:30 — Flip Ring Zero on.** Same agent, same inputs — the green column.
"5/5 blocked or contained. Deterministically. No LLM on the decision path."

**1:30–2:30 — Prove it (console → Trace Viewer).** Open `/trace`, pick
`gov-ebitda-double-count`, click the `verify` step. Show the guard decision:
`Verified=0`, the exact discrepancy (`claimed=2.82 recomputed=1.82`), terminal
`Escalate`. "Every decision is a guard `f: S×Θ→{0,1}`, evaluated LLM-free, and
the prohibited transition — releasing from the drafted state — is structurally
impossible, not merely flagged." Note the run is **auditable** and **replays
exactly**.

**2:30–3:00 — Attestation falls out (console → Attestation).** "One artifact,
same evidence: every control resolves to a replayable trace event across EU AI
Act, MAS, and Singapore MGF. Gaps are reported, never asserted." Then `/` for the
pillar map: "We own the white space — P4, deterministic runtime enforcement —
and everything else plugs into it."

## If asked "is the agent real?"
Yes — thin by design. `RING_ZERO_LLM=1 ANTHROPIC_API_KEY=… pnpm demo` runs a live
model for the (non-binding) draft prose. The governance verdict is identical
either way: the kernel governs the agent, not the other way round.

## Fallback if offline
`pnpm demo` is fully offline and deterministic (canned agent). Nothing in the
critical path needs the network.
