/**
 * Assurance / red-team harness (P3). Turns the named attacks + governance levers
 * into a repeatable, pass/fail suite over every pipeline, so "prove it keeps
 * working" is a button, not a claim. Each case asserts the DETERMINISTIC
 * expectation: clean runs release; attacks are contained; raising an agent's
 * governance level escalates; the kill switch contains downstream.
 */

import { PIPELINES, runOrchestration } from "./orchestration.js";

export type EvalExpectation = "released" | "contained";

export interface EvalCase {
  readonly pipeline: string;
  readonly pipelineLabel: string;
  readonly name: string;
  readonly kind: "clean" | "attack" | "governance-lever" | "kill-switch";
  readonly expected: EvalExpectation;
  readonly released: boolean;
  readonly contained: boolean;
  readonly haltedAt: string | null;
  readonly pass: boolean;
}

export interface EvalReport {
  readonly cases: readonly EvalCase[];
  readonly passed: number;
  readonly total: number;
  readonly passRate: number;
}

function mkCase(
  pipeline: string,
  pipelineLabel: string,
  name: string,
  kind: EvalCase["kind"],
  expected: EvalExpectation,
  result: { released: boolean; haltedAt: string | null },
): EvalCase {
  const contained = !result.released;
  const pass = expected === "released" ? result.released : contained;
  return { pipeline, pipelineLabel, name, kind, expected, released: result.released, contained, haltedAt: result.haltedAt, pass };
}

/** Run the full assurance suite across all pipelines. Deterministic and offline. */
export function runEvalSuite(): EvalReport {
  const cases: EvalCase[] = [];

  for (const p of Object.values(PIPELINES)) {
    // 1. clean run must release
    cases.push(mkCase(p.id, p.label, "Clean run releases", "clean", "released", runOrchestration({ pipeline: p.id, scenario: "clean" })));

    // 2. every attack scenario must be contained
    for (const [sid] of Object.entries(p.scenarios)) {
      if (sid === "clean") continue;
      cases.push(mkCase(p.id, p.label, p.scenarios[sid]!.label, "attack", "contained", runOrchestration({ pipeline: p.id, scenario: sid })));
    }

    // 3. max governance on every agent must contain (some agent escalates for review)
    const allTier4 = Object.fromEntries(p.agents.map((a) => [a.id, 4 as const]));
    cases.push(mkCase(p.id, p.label, "Every agent at Tier 4 escalates", "governance-lever", "contained", runOrchestration({ pipeline: p.id, tiers: allTier4 })));

    // 4. killing the last agent must contain (no release)
    const tail = p.agents[p.agents.length - 1];
    if (tail) {
      cases.push(mkCase(p.id, p.label, `Kill switch on ${tail.name} contains`, "kill-switch", "contained", runOrchestration({ pipeline: p.id, killed: [tail.id] })));
    }
  }

  const passed = cases.filter((c) => c.pass).length;
  return { cases, passed, total: cases.length, passRate: cases.length ? Math.round((passed / cases.length) * 100) : 0 };
}
