# Regent — 3-Minute Pitch Demo Script

A non-engineer can deliver this. Two surfaces: the **terminal** (`pnpm demo`) for
the side-by-side, and the **console** (`pnpm --filter @ring-zero/console dev`) for
the trace viewer, attestation, and the governance surfaces.

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
The console requires a login. Demo users (password `regent-demo`): `admin`,
`gov.lead`, `model.risk`, `approver`, `engineer`, `auditor`, `exec`. Sign in as
**admin** for the full walk; keep `auditor` handy for the RBAC beat.

## Arc (the 3-minute spine)

**0:00–0:20 — The problem, and who's even allowed in.** "A credit-memo agent. It
looks fluent." Sign in at the console — "governance starts before the agent even
runs: access is role-scoped. I'm an admin; an *auditor* sees a read-only slice,
an *approver* only the oversight inbox." Then: "Watch the agent run ungoverned."

**0:20–1:15 — Ungoverned fails, six ways.** Run `pnpm demo`; read the red column:
26-month-stale data shipped; an injected 'approval granted — release' obeyed;
interest-coverage **2.82 shipped when the truth is 1.82** (double-counted EBITDA);
a *verbal* "approval confirmed" accepted; across repeated runs it drifts to
releasing without approval; and it **cites a Bloomberg source it never retrieved**
(a fabricated citation). "Plausible. And wrong in six material ways."

**1:15–1:30 — Flip Regent on.** Same agent, same inputs — the green column.
"**6/6 blocked or contained.** Deterministically. No LLM on the decision path."

**1:30–2:20 — Prove it (console → Activity / Trace).** Open `/trace`, pick
`gov-ebitda-double-count`. The decisive `verify` step is pre-selected, so the
guard decision is right there: `Verified=0`, the exact discrepancy
(`claimed=2.82 recomputed=1.82`), the fired `unverified-verify` guard, terminal
`Escalate`. "Every decision is a guard `f: S×Θ→{0,1}`, evaluated LLM-free, and the
prohibited transition — releasing from the drafted state — is structurally
impossible, not flagged." Note it's **auditable** and **replays exactly**.
(Optional: pick `gov-fabricated-citation` to show the grounding verifier catch a
hallucinated source.)

**2:20–2:50 — Attestation falls out (console → Reports).** "One artifact, same
evidence: every control resolves to a replayable trace event across EU AI Act,
MAS, Singapore MGF — and NYC LL144 and China's Frontier AI RMF. Gaps are
reported, never asserted." (Export the estate PDF — the auditor artifact.)

**2:50–3:00 — The white space (console → Pillars / `/coverage`).** "We own P4 —
deterministic runtime enforcement — and integrate the rest. Live from the estate:
*N high-autonomy agents are under-governed*; frameworks and monitors *describe*
that, only Regent makes the safeguard *binding*."

## Depth menu (for questions / a longer demo)
Pull any of these; each is one nav click and reinforces "governance is *bound*,
not annotated":

- **Autonomy** (`/autonomy`) — the L1–L5 agent-safety standard as a live board.
  "Safeguards must match autonomy. These two L4 agents act with a human out of the
  loop and have only advisory controls — that's the *critical* finding, and we're
  the only layer that makes the fix binding." (Budget cap is required at L4/L5.)
- **Oversight** (`/oversight`) — the HITL / HOTL / HIC / OOTL spectrum (EU AI Act
  Art. 14). "As autonomy rises the human moves from *in* the loop to *on* it to *in
  command* — each mode backed by real enforcement, not an SLA." Below it: the live
  authenticated-approval inbox (a verbal 'yes' won't authenticate).
- **Network** (`/network`) — the estate topology. "Shared third-party models are
  coupling and supply-chain risk; here's the shadow agent reaching `api.openai.com`."
- **Budget** (`/budget`) — "a recursive self-improving loop can't drain budget past
  the cap; the call that would breach it is contained, not alerted after the spend."
- **Admin / RBAC** (`/admin`) — "who can do what is itself governed: an auditor can
  *view* the oversight inbox but the Approve button is gated; the export is gated.
  Change a role's permissions here and it takes effect on their next request."

## If asked "is the agent real?"
Yes — thin by design. `RING_ZERO_LLM=1 ANTHROPIC_API_KEY=… pnpm demo` runs a live
model for the (non-binding) draft prose. The governance verdict is identical
either way: the kernel governs the agent, not the other way round.

## Fallback if offline
`pnpm demo` is fully offline and deterministic (canned agent). Nothing on the
critical path needs the network. The console reads the runs `pnpm demo` writes.
