# Ring Zero

> The deterministic enforcement kernel that makes AI governance binding at
> runtime — and turns the same evidence into audit-ready compliance.

Every AI-governance vendor today *observes* agents; almost none can *stop* one.
Ring Zero is the runtime execution-governance kernel (pillar **P4**) that other
governance functions plug into. This repository is the **seed prototype**: one
pillar built deep, seven built thin-but-real around it, and a three-minute
side-by-side demo as the acceptance test.

See [`CLAUDE.md`](./CLAUDE.md) for the full thesis, pillar map, and build stances,
and [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the canonical objects and guard loop.

## Status

**All phases complete (0–7).** Deterministic kernel (P4) + logical verifiers (P3)
built deep; mediation/identity/approval, telemetry+replay, registry/tiering/
attestation, the side-by-side demo, and the Next.js console all working. `pnpm
demo` blocks 5/5 attacks deterministically; the governed run replays exactly and
yields a 5/5 attestation. 78 TS tests + 10 Python tests green.

## Quick start

```bash
pnpm install                              # install workspace deps
pnpm check                                # lint + typecheck + test (TS) + ruff/mypy/pytest (Python)
pnpm demo                                 # the credit-memo side-by-side (ungoverned vs governed)
pnpm --filter @ring-zero/console dev      # the investor console → http://localhost:3000
pnpm trace:sample                         # print governed trajectories + write docs/sample-trace.json
```

Live agent (non-binding draft prose; the governance verdict stays deterministic):

```bash
RING_ZERO_LLM=1 ANTHROPIC_API_KEY=sk-… pnpm demo
```

## Toolchain

Node 20 (pnpm via corepack), uv-managed Python 3.12. On a fresh machine the
toolchain installs locally under `~/.local` with no sudo. PATH is added to
`~/.zshrc`.

## Layout

```
packages/kernel      ★ deterministic guard engine + transition system W   (REAL, deep)
packages/policy        capability catalogue + builder→W compiler          (REAL)
packages/mediation     complete-mediation tool gateway + approval events  (REAL)
packages/verify      ★ Python logical verifiers (numeric/register/contra) (REAL)
packages/telemetry     OTel governance-semantic traces + SQLite + replay  (THIN)
packages/pillars       registry · risk tiering · attestation export       (THIN)
packages/sdk           client that routes all tool intents via mediation
apps/demo            ★ credit-memo ungoverned-vs-governed + 5 attacks
apps/console           Next.js investor-facing control plane
docs/                  pitch demo script
```
# ringzero
