/**
 * CrewAI adapter — govern an imported CrewAI crew with Regent.
 *
 * A CrewAI crew (agents + sequential tasks) is compiled to a Regent transition
 * system so the crew runs under the deterministic kernel. Declarative only: task
 * tools map to vetted governance intents; no imported code runs on the binding
 * path.
 */

import type { IntentClass } from "@ring-zero/kernel";
import type { WorkflowSpec } from "@ring-zero/policy";

export interface CrewAgent {
  readonly role: string;
  readonly goal?: string;
  readonly tools?: readonly string[];
}
export interface CrewTask {
  readonly description: string;
  readonly agent?: string;
  readonly tools?: readonly string[];
}
export interface CrewAISpec {
  readonly name?: string;
  readonly process?: "sequential" | "hierarchical";
  readonly agents: readonly CrewAgent[];
  readonly tasks: readonly CrewTask[];
  readonly tier?: 1 | 2 | 3 | 4;
}

const DISPATCH = /send|post|email|execute|dispatch|write|api|payment|order|trade|submit|publish/i;
const RETRIEVE = /search|retrieve|lookup|read|query|fetch|browse|scrape/i;

function taskIntent(t: CrewTask): IntentClass {
  const tools = (t.tools ?? []).join(" ");
  if (DISPATCH.test(tools)) return "dispatch";
  if (RETRIEVE.test(tools)) return "retrieve";
  return "compute";
}

function slug(s: string, i: number): string {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20);
  return `t${i}-${base || "task"}`;
}

/** Compile a CrewAI crew to a governed Regent WorkflowSpec (tasks → a governed chain). */
export function compileCrewAI(spec: CrewAISpec): WorkflowSpec {
  if (!spec.tasks?.length) throw new Error("CrewAI spec needs at least one task");
  const ids = spec.tasks.map((t, i) => slug(t.agent ?? t.description ?? "task", i));
  const seq = ["start", ...ids, "done"];
  const states = [
    { id: "start", initial: true },
    ...ids.map((id) => ({ id })),
    { id: "done", terminal: true },
  ];
  const transitions = [];
  for (let i = 0; i < seq.length - 1; i++) {
    const intent: IntentClass = i < spec.tasks.length ? taskIntent(spec.tasks[i]!) : "compute";
    transitions.push({ from: seq[i]!, to: seq[i + 1]!, action: { id: seq[i + 1]!, intent } });
  }
  return {
    id: spec.name ?? "crewai",
    tier: spec.tier ?? 3,
    states,
    transitions,
    seed: { attrs: { Alignment: 1, Verified: 1, Confidence: 1, Length: 0, Information: 0.9 } },
  };
}
