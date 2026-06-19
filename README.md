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

**Phase 0 — scaffold.** Monorepo, toolchain, strict TS / ruff / mypy / Vitest /
pytest, OTel collector config, SQLite migration runner, and `pnpm demo` / `pnpm
dev` stubs. No governance logic yet — that lands in Phase 1 (the kernel).

## Quick start

```bash
pnpm install      # install workspace deps
pnpm check        # lint + typecheck + test (TS) + ruff/mypy/pytest (Python)
pnpm db:migrate   # apply SQLite migrations
pnpm demo         # the credit-memo side-by-side (Phase 6+)
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
