/**
 * `pnpm demo` entrypoint.
 *
 * Phase 0: a banner stub. Phase 6 replaces this with the credit-memo (U3)
 * side-by-side: the same thin agent composing C1-C4, run (a) UNGOVERNED and
 * (b) GOVERNED by Ring Zero, driven through the five attacks. That side-by-side
 * is the acceptance test for the whole prototype.
 */

const BANNER = `
┌────────────────────────────────────────────────────────────────────┐
│  RING ZERO — deterministic execution-governance kernel             │
│  Phase 0 scaffold. The demo lands in Phase 6.                      │
├────────────────────────────────────────────────────────────────────┤
│  The "aha": one credit-memo agent, run twice.                      │
│    • Ungoverned → 5 material failures (stale data, injected         │
│      approval, 2.82 vs 1.82 coverage, verbal approval, drift).      │
│    • Governed   → all 5 blocked/contained, deterministically,       │
│      LLM-free on the binding path, fail-closed, fully replayable.   │
└────────────────────────────────────────────────────────────────────┘
`;

function main(): void {
  console.log(BANNER);
  console.log("Next: Phase 1 — the kernel (packages/kernel). See ARCHITECTURE.md.");
}

main();
