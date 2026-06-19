/**
 * Server-only data access. Reads the REAL SQLite telemetry produced by
 * `pnpm demo` — no mock data. Opens read-only and degrades gracefully (empty
 * state) if the demo hasn't been run yet.
 */

import Database from "better-sqlite3";
import { resolve } from "node:path";

const DB_PATH =
  process.env.RING_ZERO_DB ?? resolve(process.cwd(), "..", "..", ".telemetry", "demo.db");

function open(): Database.Database | null {
  try {
    return new Database(DB_PATH, { readonly: true, fileMustExist: true });
  } catch {
    return null;
  }
}

export interface RunSummary {
  runId: string;
  agentId: string;
  governed: boolean;
  tier: number;
  terminalKind: string;
  auditable: boolean;
}

export interface GuardEval {
  guard: string;
  outcome: string;
  score: number | null;
  threshold: number | null;
  advisory: boolean;
}

export interface Step {
  index: number;
  fromNode: string;
  toNode: string;
  actionId: string;
  intent: string;
  decision: string;
  outcome: string;
  preAttrs: Record<string, number>;
  postAttrs: Record<string, number>;
  guards: GuardEval[];
  note: string | null;
}

export interface RunDetail extends RunSummary {
  policyId: string;
  terminalDetail: string;
  steps: Step[];
}

export interface AgentCard {
  agentId: string;
  name: string;
  purpose: string;
  owner: string;
  supervisingUser: string;
  tier: number;
  tools: string[];
  authorityScopes: string[];
  capabilities: string[];
  traceLinks: { runId: string; governed: boolean; terminalKind: string; auditable: boolean }[];
}

export function dbAvailable(): boolean {
  const db = open();
  if (db) {
    db.close();
    return true;
  }
  return false;
}

export function listRuns(): RunSummary[] {
  const db = open();
  if (!db) return [];
  try {
    const rows = db
      .prepare(
        "SELECT run_id, agent_id, governed, tier, terminal_kind, auditable FROM runs ORDER BY run_id",
      )
      .all() as Array<{
      run_id: string;
      agent_id: string;
      governed: number;
      tier: number;
      terminal_kind: string;
      auditable: number;
    }>;
    return rows.map((r) => ({
      runId: r.run_id,
      agentId: r.agent_id,
      governed: r.governed === 1,
      tier: r.tier,
      terminalKind: r.terminal_kind,
      auditable: r.auditable === 1,
    }));
  } finally {
    db.close();
  }
}

export function loadRun(runId: string): RunDetail | null {
  const db = open();
  if (!db) return null;
  try {
    const run = db.prepare("SELECT * FROM runs WHERE run_id = ?").get(runId) as
      | Record<string, unknown>
      | undefined;
    if (!run) return null;
    const spans = db
      .prepare("SELECT * FROM spans WHERE run_id = ? ORDER BY step_index")
      .all(runId) as Array<Record<string, unknown>>;
    const guards = db
      .prepare("SELECT * FROM guard_evaluations WHERE run_id = ? ORDER BY step_index, id")
      .all(runId) as Array<Record<string, unknown>>;

    const steps: Step[] = spans.map((s) => ({
      index: s["step_index"] as number,
      fromNode: s["from_node"] as string,
      toNode: s["to_node"] as string,
      actionId: s["name"] as string,
      intent: s["tool_intent"] as string,
      decision: s["decision"] as string,
      outcome: s["outcome"] as string,
      preAttrs: JSON.parse((s["pre_attrs"] as string) ?? "{}") as Record<string, number>,
      postAttrs: JSON.parse((s["post_attrs"] as string) ?? "{}") as Record<string, number>,
      guards: guards
        .filter((g) => g["span_id"] === s["span_id"])
        .map((g) => ({
          guard: g["guard"] as string,
          outcome: g["outcome"] as string,
          score: (g["score"] as number | null) ?? null,
          threshold: (g["threshold"] as number | null) ?? null,
          advisory: g["advisory"] === 1,
        })),
      note: (s["note"] as string | null) ?? null,
    }));

    return {
      runId: run["run_id"] as string,
      agentId: run["agent_id"] as string,
      governed: run["governed"] === 1,
      tier: run["tier"] as number,
      policyId: (run["policy_id"] as string) ?? "",
      terminalKind: (run["terminal_kind"] as string) ?? "",
      terminalDetail: (run["terminal_detail"] as string) ?? "",
      auditable: run["auditable"] === 1,
      steps,
    };
  } finally {
    db.close();
  }
}

export function listAgents(): AgentCard[] {
  const db = open();
  if (!db) return [];
  try {
    const rows = db.prepare("SELECT * FROM agents ORDER BY agent_id").all() as Array<
      Record<string, unknown>
    >;
    return rows.map((r) => {
      const agentId = r["agent_id"] as string;
      const links = db
        .prepare("SELECT run_id, governed, terminal_kind, auditable FROM runs WHERE agent_id = ? ORDER BY run_id")
        .all(agentId) as Array<{ run_id: string; governed: number; terminal_kind: string; auditable: number }>;
      return {
        agentId,
        name: r["name"] as string,
        purpose: r["purpose"] as string,
        owner: r["owner"] as string,
        supervisingUser: r["supervising_user"] as string,
        tier: r["tier"] as number,
        tools: JSON.parse((r["tools"] as string) ?? "[]") as string[],
        authorityScopes: JSON.parse((r["authority_scopes"] as string) ?? "[]") as string[],
        capabilities: JSON.parse((r["capabilities"] as string) ?? "[]") as string[],
        traceLinks: links.map((l) => ({
          runId: l.run_id,
          governed: l.governed === 1,
          terminalKind: l.terminal_kind,
          auditable: l.auditable === 1,
        })),
      };
    });
  } finally {
    db.close();
  }
}
