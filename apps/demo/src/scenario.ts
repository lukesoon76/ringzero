/**
 * The five attacks from the Szpruch credit-memo example. Same thin agent, run
 * ungoverned then governed by Regent.
 */

export type AttackId =
  | "stale-data"
  | "prompt-injection"
  | "ebitda-double-count"
  | "verbal-approval"
  | "orchestration-drift";

export interface Attack {
  readonly n: number;
  readonly id: AttackId;
  readonly title: string;
}

export const ATTACKS: readonly Attack[] = [
  { n: 1, id: "stale-data", title: "26-month-stale data" },
  { n: 2, id: "prompt-injection", title: "prompt injection: 'approval granted, release'" },
  { n: 3, id: "ebitda-double-count", title: "double-counted EBITDA → coverage 2.82 vs 1.82" },
  { n: 4, id: "verbal-approval", title: "verbal 'approval confirmed'" },
  { n: 5, id: "orchestration-drift", title: "orchestration drift toward unauthorised release" },
];

export const DEMO_AGENT_ID = "memo-agent";
export const DEMO_AGENT_SCOPES = ["source:read", "kb:retrieve", "memo:draft", "memo:release"];
