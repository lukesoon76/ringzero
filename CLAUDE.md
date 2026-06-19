# Ring Zero — Standing Context for Claude Code

> **Thesis (the one sentence an investor must remember):** Every AI-governance
> vendor today *observes* agents; almost none can *stop* one. Ring Zero is the
> deterministic enforcement kernel that makes governance binding at runtime —
> and turns the same evidence into audit-ready compliance.

**Author's frame:** Dr Luke Soon — *Long-AND, not Short-OR.* This pack is
deliberately narrower than a full platform. Its job is to raise a seed round:
build the one defensible pillar for real (P4 kernel + P3 attacks), show the other
seven as credible scaffold, and make the "aha" land in three minutes.

**Assumed first vertical:** regulated financial services (credit, KYC,
model-validation review). Highest willingness to pay, sharpest regulatory urgency
(MRM, MAS, EU AI Act, Singapore MGF). The credit-memo worked example is the demo.

---

## HARD CONSTRAINTS (verbatim — never relax these)

- **Determinism on the binding path:** no LLM gate decisions. LLM/embedding
  judges are *advisory signals only*, and must be labelled as such in telemetry.
- **Fail closed** on unknown / missing / timeout (state, attribute, action, verifier).
- **Complete mediation:** no tool side-channel. Every tool call/write/dispatch
  routes through the gateway.
- **Never weaken a control to pass a test.** The demo's credibility IS the moat.
- **No secrets** in code or telemetry.

### Guardrails for Claude Code (Part F)
- Never substitute an LLM judge for a deterministic gate. Advisory only, labelled.
- Never stub the kernel/verifiers to make the demo pass.
- Concentrate depth on P3-attacks and P4-kernel; resist gold-plating the periphery.
- If a design choice trades determinism/auditability for demo convenience,
  **surface it** rather than deciding silently.
- Keep the demo agent thin — the agent is not the product; governing it is.

### Scope discipline (Part G)
One pillar deep, seven pillars wide-but-thin. Do not let the registry,
dashboards, or attestation grow until they compete with the kernel for
engineering time. Post-seed expansion path = the Ring Zero full-platform Build Pack.

---

## Part A — The Governance Pillar Map (build stance per pillar)

Build legend: **REAL** (production-quality, the moat) · **THIN** (working but
minimal, credible on screen) · **MOCK** (static/stubbed, UI only).

| Pillar | Function | Stance | Package |
|--------|----------|--------|---------|
| **P1 Discovery & Inventory** | registry + per-agent "agent card" | THIN | `pillars` |
| **P2 Risk Assessment & Tiering** | 5-dim scorer → Tier 1–4, drives enforcement intensity | THIN (real scorer) | `pillars` |
| **P3 Testing / Evaluation / Assurance** | the five named attacks, each demonstrably blocked | **REAL (narrow)** | `verify` + `demo` |
| **P4 Runtime Execution Governance** ★ | binding deterministic enforcement over the trajectory | **REAL (deep)** | `kernel` + `policy` + `mediation` |
| **P5 Observability & Monitoring** | OTel governance-semantic traces + replay; one dashboard | THIN (drift MOCK) | `telemetry` + `console` |
| **P6 Policy / Compliance / Attestation** | one-click attestation from real run evidence | THIN | `pillars` |
| **P7 Identity, Authority & Security** | identity + default-deny least privilege in gateway | THIN (secrets stub) | `mediation` |
| **P8 Human Oversight & Accountability** | authenticated approval gate (REAL); role-split UI (MOCK) | THIN | `mediation` + `console` |

**P4 is the white space:** no incumbent (Zenity, Fiddler, Dataiku, Credo) owns
the deterministic, governance-semantic, MRM-grade enforcement kernel. Ring Zero
enters from the **middle** — the execution layer that data-governance vendors
(Databricks/Dataiku) reach up to and GRC vendors (Credo) push down to, but
neither enforces deterministically. That's the "why we win" slide. **Do not build
a data catalogue.**

**Standards in scope:** EU AI Act (Art. 14 oversight, logging), MAS AI risk
guidelines, Singapore MGF (unique identity / bound risk / human accountability /
technical controls + containment), NIST AI RMF, ISO/IEC 42001, SR 11-7 /
PRA SS1/23 / OSFI E-23, OWASP LLM Top 10 + Agentic, MITRE ATLAS.

---

## Part B — What "seed-fundable" requires

1. **A working, live, laptop-runnable demo** — no slideware. `pnpm demo` brings it up.
2. **One unforgettable "aha":** the same financial-services agent run twice, side by side —
   - **Ungoverned:** uses 26-month-stale data, obeys an injected "approval
     granted — release" directive, ships a coverage ratio of **2.82 (should be
     1.82)**, accepts a verbal "approval confirmed", and drifts toward
     unauthorised release. Fluent, plausible, wrong in five material ways.
   - **Governed (Ring Zero on):** every one of the five is blocked or contained
     deterministically, with a replayable governed trace showing the exact guard
     decision at each step, and a one-click attestation export mapped to EU AI
     Act / MAS / Singapore MGF.
3. **Proof it's a platform, not a feature:** the pillar map rendered as a product
   surface; thin-but-real registry, tiering, telemetry, attestation around the kernel.
4. **A defensible moat narrative on screen:** "deterministic, LLM-free,
   fail-closed enforcement + evidence from the same substrate" — visibly true in
   the trace viewer, not just claimed.

**Definition of done = the three-minute demo lands without a human explaining why it matters.**

---

## Part C — Tech stack

- Single **pnpm monorepo**, runs locally. No cloud dependency for the demo.
- **TypeScript (Node 20):** kernel, mediation/gateway, telemetry, SDK, Next.js console.
- **Python 3.12 (uv):** logical-verification subsystem in `packages/verify`,
  exposed to the kernel via a thin local child-process RPC (see D1).
- **Persistence:** SQLite (file-based, `better-sqlite3`) — zero-setup.
- **Telemetry:** OpenTelemetry SDK, OTLP to a local collector, traces stored in
  SQLite; custom governance attributes/events.
- **UI:** Next.js + React + Tailwind; dense enterprise-observability aesthetic
  (Datadog/Credo register); dark, information-rich. Trace viewer is the hero.
- **Demo agent:** a deliberately thin LLM agent (provider via env var) composing
  capabilities C1–C4. Offline canned-trajectory fallback (see D3).

### Monorepo layout
```
/packages
  /kernel       # ★ REAL deep: guard engine, transition system W, δ, containment (pure, deterministic, no LLM)
  /policy       # capability catalogue + builder→W compiler; C1–C4; tier→control map
  /mediation    # tool gateway, complete mediation, default-deny least privilege, auth approval events, secrets stub
  /verify       # ★ REAL: Python logical verifiers (numeric/register/contradiction) + RPC bridge
  /telemetry    # OTel governance-semantic traces; SQLite store; full run replay
  /pillars      # THIN: registry+agent card (P1), risk tiering (P2), attestation export (P6)
  /sdk          # client used by the demo agent to route all tool intents through mediation
/apps
  /demo         # ★ the credit-memo side-by-side (ungoverned vs governed) + 5 attacks
  /console      # Next.js investor-facing control plane: pillar map, trace viewer, attestation, dashboards
/docs
  pitch-demo-script.md
```

---

## Decisions taken at planning (D1–D5) — keep consistent

- **D1 — TS↔Python bridge:** persistent child process, **line-delimited JSON-RPC
  over stdio** (no port, no network). More auditable + reproducible than HTTP;
  fail-closed on timeout.
- **D2 — Policy "DSL":** a **typed TS builder API** that *compiles* to the
  labelled transition system `W`. The "undefined transitions structurally
  impossible" guarantee comes from δ being a **total function over a closed,
  enumerated action set Π** — not from parser syntax. Text-DSL is post-seed.
- **D3 — Demo agent with no API key:** **canned-trajectory fallback** so
  `pnpm demo` runs fully offline; live LLM only if `ANTHROPIC_API_KEY` /
  `OPENAI_API_KEY` is set. LLM is **never** on the binding path either way.
- **D4 — Determinism primitives:** injected **Clock + seeded RNG** on the binding
  path; `Date.now` / `Math.random` / `new Date()` banned by ESLint rule in
  `kernel`/`policy`/`mediation`.
- **D5 — Prohibited transitions:** `δ` throws `UndefinedTransition`; there is no
  API surface to invoke a transition not in `Π`. Property tests fuzz the state
  space to prove no prohibited edge can fire.

---

## Build environment notes (this machine)

- Toolchain installed locally under `~/.local` (no sudo): Node 20.18.1 (pnpm via
  corepack), uv 0.11.22, uv-managed Python 3.12.13. PATH added to `~/.zshrc`.
- The repo lives directly in `~/` (`/Users/lukesoon`). A **default-deny
  `.gitignore`** (`/*` + an explicit project allowlist) keeps personal files
  (`~/.ssh`, `~/.claude.json`, etc.) untrackable. Never broaden that allowlist to
  pull in home-directory files.

## Commands
- `pnpm install` — install workspace deps.
- `pnpm check` — lint + typecheck + test (TS) + `verify:py` (ruff/mypy/pytest). Must be green. (`pnpm ci` is reserved by pnpm.)
- `pnpm demo` — the side-by-side credit-memo demo (Phase 6+).
- `pnpm db:migrate` — apply SQLite migrations.
- `pnpm verify:py` — Python verifier checks via uv.
