/**
 * `pnpm trace:sample` — run the credit-memo policy through the kernel and print a
 * replayable governed trajectory, then prove replay is bit-identical. Writes the
 * full trace JSON to docs/sample-trace.json.
 *
 * This is the Phase 1 "replayable sample trace" deliverable. The trace carries no
 * timestamps — it is purely a function of (W, Θ, seed), so it replays exactly.
 */

import { runTrajectory, type TraceStep } from "@ring-zero/kernel";
import {
  buildCreditMemoPolicy,
  seedDoubleCountedEbitda,
  seedHappyPath,
  seedStaleData,
  seedVerbalApproval,
  thetaForTier,
} from "@ring-zero/policy";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const W = buildCreditMemoPolicy();
const theta = thetaForTier(3);

function fmtAttrs(s: TraceStep): string {
  const a = s.postAttrs;
  return `A=${a.Alignment.toFixed(2)} V=${a.Verified} C=${a.Confidence.toFixed(2)} L=${a.Length}`;
}

function printTrace(label: string, seed: Parameters<typeof runTrajectory>[2]): void {
  const t = runTrajectory(W, theta, seed);
  console.log(`\n━━ ${label} ━━  tier=${t.tier}`);
  for (const s of t.steps) {
    const arrow = s.fromNode === s.toNode ? `${s.fromNode}` : `${s.fromNode} → ${s.toNode}`;
    console.log(
      `  [${s.index}] ${s.decision.padEnd(9)} ${s.action.id.padEnd(12)} ${arrow.padEnd(28)} ${fmtAttrs(s).padEnd(28)} ${s.outcome}` +
        (s.note ? `  — ${s.note}` : ""),
    );
  }
  console.log(`  ⇒ TERMINAL: ${t.terminal.kind} @ ${t.terminal.node} — ${t.terminal.detail}`);
}

console.log("Ring Zero — credit-memo sample trajectories (deterministic, LLM-free)");

printTrace("GOVERNED happy path", seedHappyPath);
printTrace("ATTACK #1  26-month-stale data", seedStaleData);
printTrace("ATTACK #3  double-counted EBITDA (2.82 vs 1.82)", seedDoubleCountedEbitda);
printTrace("ATTACK #4  verbal 'approval confirmed'", seedVerbalApproval);

// Replay determinism.
const a = runTrajectory(W, theta, seedHappyPath);
const b = runTrajectory(W, theta, seedHappyPath);
console.log(`\nReplay determinism: ${JSON.stringify(a) === JSON.stringify(b) ? "IDENTICAL ✓" : "MISMATCH ✗"}`);

const outPath = resolve(here, "..", "docs", "sample-trace.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(a, null, 2));
console.log(`Full governed trace written to ${outPath}`);
