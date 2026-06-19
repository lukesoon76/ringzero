/**
 * Governance-semantic telemetry store (P5 substrate). One run = one trace; each
 * step is a span carrying tool-intent + decision + the guard evaluations that
 * drove it. The store supports FULL RUN REPLAY (reconstruct the exact decision
 * sequence and state at every step) and an auditability check: a run missing the
 * telemetry to reconstruct any binding decision is flagged un-auditable — never
 * silently accepted.
 *
 * The binding-path trace (the kernel Trajectory) carries no timestamps, so the
 * reconstructed decision sequence is bit-identical to the original. Wall-clock
 * timing lives only in span start/end columns and is not part of replay equality.
 */

import type { GovernedAttributes, Trajectory } from "@ring-zero/kernel";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrate } from "./migrate.js";
import { DEFAULT_DB_PATH } from "./paths.js";

export interface RecordRunOptions {
  readonly runId: string;
  readonly agentId: string;
  readonly governed: boolean;
  /** Deterministic-friendly timestamp; defaults to a fixed value for reproducible tests. */
  readonly startedAt?: string;
  readonly endedAt?: string;
}

export interface ReconstructedGuard {
  readonly guard: string;
  readonly outcome: string;
  readonly score: number | null;
  readonly threshold: number | null;
  readonly advisory: boolean;
}

export interface ReconstructedStep {
  readonly index: number;
  readonly fromNode: string;
  readonly toNode: string;
  readonly action: { readonly id: string; readonly intent: string; readonly kind: string };
  readonly decision: string;
  readonly outcome: string;
  readonly preAttrs: GovernedAttributes;
  readonly postAttrs: GovernedAttributes;
  readonly guards: readonly ReconstructedGuard[];
  readonly note: string | null;
}

export interface ReconstructedRun {
  readonly runId: string;
  readonly agentId: string;
  readonly governed: boolean;
  readonly tier: number;
  readonly policyId: string;
  readonly terminal: { readonly kind: string; readonly detail: string };
  readonly steps: readonly ReconstructedStep[];
}

export interface AuditReport {
  readonly runId: string;
  readonly auditable: boolean;
  readonly issues: readonly string[];
}

interface RunRow {
  run_id: string;
  agent_id: string;
  governed: number;
  tier: number;
  policy_id: string;
  terminal_kind: string;
  terminal_detail: string;
}
interface SpanRow {
  span_id: string;
  step_index: number;
  from_node: string;
  to_node: string;
  action_kind: string;
  tool_intent: string;
  decision: string;
  outcome: string;
  guard_eval_count: number;
  pre_attrs: string;
  post_attrs: string;
  note: string | null;
  name: string;
}
interface GuardRow {
  span_id: string;
  guard: string;
  outcome: string;
  score: number | null;
  threshold: number | null;
  advisory: number;
}

const FIXED_TS = "1970-01-01T00:00:00.000Z";

export class TelemetryStore {
  private readonly db: Database.Database;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    mkdirSync(dirname(dbPath), { recursive: true });
    migrate(dbPath);
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
  }

  close(): void {
    this.db.close();
  }

  /** Persist a kernel Trajectory as a governance-semantic trace. */
  recordRun(trajectory: Trajectory, opts: RecordRunOptions): void {
    const startedAt = opts.startedAt ?? FIXED_TS;
    const endedAt = opts.endedAt ?? startedAt;

    const insRun = this.db.prepare(
      `INSERT OR REPLACE INTO runs
       (run_id, agent_id, governed, tier, started_at, ended_at, terminal, auditable, policy_id, terminal_kind, terminal_detail)
       VALUES (@run_id,@agent_id,@governed,@tier,@started_at,@ended_at,@terminal,1,@policy_id,@terminal_kind,@terminal_detail)`,
    );
    const insSpan = this.db.prepare(
      `INSERT INTO spans
       (span_id, run_id, parent_span_id, name, capability_id, tool_intent, started_at, ended_at,
        from_node, to_node, action_kind, step_index, decision, outcome, guard_eval_count, pre_attrs, post_attrs, note)
       VALUES (@span_id,@run_id,@parent,@name,@cap,@intent,@s,@e,@from,@to,@kind,@idx,@decision,@outcome,@gcount,@pre,@post,@note)`,
    );
    const insGuard = this.db.prepare(
      `INSERT INTO guard_evaluations (run_id, span_id, step_index, guard, score, threshold, outcome, advisory)
       VALUES (?,?,?,?,?,?,?,?)`,
    );

    const tx = this.db.transaction(() => {
      insRun.run({
        run_id: opts.runId,
        agent_id: opts.agentId,
        governed: opts.governed ? 1 : 0,
        tier: trajectory.tier,
        started_at: startedAt,
        ended_at: endedAt,
        terminal: trajectory.terminal.kind,
        policy_id: trajectory.policyId,
        terminal_kind: trajectory.terminal.kind,
        terminal_detail: trajectory.terminal.detail,
      });
      for (const step of trajectory.steps) {
        const spanId = `${opts.runId}-${step.index}`;
        const cap = step.action.kind === "capability" ? (step.action.id.split(".")[0] ?? null) : null;
        insSpan.run({
          span_id: spanId,
          run_id: opts.runId,
          parent: opts.runId,
          name: step.action.id,
          cap,
          intent: step.action.intent,
          s: startedAt,
          e: endedAt,
          from: step.fromNode,
          to: step.toNode,
          kind: step.action.kind,
          idx: step.index,
          decision: step.decision,
          outcome: step.outcome,
          gcount: step.guardEvaluations.length,
          pre: JSON.stringify(step.preAttrs),
          post: JSON.stringify(step.postAttrs),
          note: step.note ?? null,
        });
        for (const g of step.guardEvaluations) {
          insGuard.run(
            opts.runId,
            spanId,
            step.index,
            g.guard,
            g.score ?? null,
            g.threshold ?? null,
            g.fired ? "fired" : "passed",
            g.advisory ? 1 : 0,
          );
        }
      }
    });
    tx();
  }

  /** Reconstruct a run's decision sequence + state from telemetry alone. */
  loadRun(runId: string): ReconstructedRun {
    const run = this.db.prepare("SELECT * FROM runs WHERE run_id = ?").get(runId) as RunRow | undefined;
    if (!run) throw new Error(`no such run: ${runId}`);
    const spans = this.db
      .prepare("SELECT * FROM spans WHERE run_id = ? ORDER BY step_index")
      .all(runId) as SpanRow[];
    const guards = this.db
      .prepare("SELECT * FROM guard_evaluations WHERE run_id = ? ORDER BY step_index, id")
      .all(runId) as GuardRow[];

    const steps: ReconstructedStep[] = spans.map((s) => ({
      index: s.step_index,
      fromNode: s.from_node,
      toNode: s.to_node,
      action: { id: s.name, intent: s.tool_intent, kind: s.action_kind },
      decision: s.decision,
      outcome: s.outcome,
      preAttrs: JSON.parse(s.pre_attrs) as GovernedAttributes,
      postAttrs: JSON.parse(s.post_attrs) as GovernedAttributes,
      guards: guards
        .filter((g) => g.span_id === s.span_id)
        .map((g) => ({
          guard: g.guard,
          outcome: g.outcome,
          score: g.score,
          threshold: g.threshold,
          advisory: g.advisory === 1,
        })),
      note: s.note,
    }));

    return {
      runId: run.run_id,
      agentId: run.agent_id,
      governed: run.governed === 1,
      tier: run.tier,
      policyId: run.policy_id,
      terminal: { kind: run.terminal_kind, detail: run.terminal_detail },
      steps,
    };
  }

  /**
   * A run is auditable iff every recorded step retains the guard evaluations
   * needed to reconstruct its binding decision. A suppressed/missing decision
   * event flags the run un-auditable (fail closed), persisted to runs.auditable.
   */
  auditRun(runId: string): AuditReport {
    const spans = this.db
      .prepare("SELECT span_id, step_index, guard_eval_count, decision FROM spans WHERE run_id = ? ORDER BY step_index")
      .all(runId) as Pick<SpanRow, "span_id" | "step_index" | "guard_eval_count" | "decision">[];
    const countFor = this.db.prepare(
      "SELECT COUNT(*) AS n FROM guard_evaluations WHERE span_id = ?",
    );
    const issues: string[] = [];
    for (const s of spans) {
      const actual = (countFor.get(s.span_id) as { n: number }).n;
      if (actual < s.guard_eval_count) {
        issues.push(
          `step ${s.step_index} (${s.decision}): ${actual}/${s.guard_eval_count} guard evaluations present — binding decision not reconstructable`,
        );
      }
    }
    const auditable = issues.length === 0;
    this.db.prepare("UPDATE runs SET auditable = ? WHERE run_id = ?").run(auditable ? 1 : 0, runId);
    return { runId, auditable, issues };
  }

  isAuditable(runId: string): boolean {
    const row = this.db.prepare("SELECT auditable FROM runs WHERE run_id = ?").get(runId) as
      | { auditable: number }
      | undefined;
    return row?.auditable === 1;
  }

  listRuns(): ReadonlyArray<{ runId: string; governed: boolean; terminalKind: string; auditable: boolean }> {
    const rows = this.db
      .prepare("SELECT run_id, governed, terminal_kind, auditable FROM runs ORDER BY run_id")
      .all() as { run_id: string; governed: number; terminal_kind: string; auditable: number }[];
    return rows.map((r) => ({
      runId: r.run_id,
      governed: r.governed === 1,
      terminalKind: r.terminal_kind,
      auditable: r.auditable === 1,
    }));
  }
}

/** Deterministic projection used to compare a reconstructed run against the original. */
export function projectTrajectory(trajectory: Trajectory): readonly string[] {
  return trajectory.steps.map(
    (s) =>
      `${s.index}|${s.fromNode}->${s.toNode}|${s.action.id}|${s.decision}|${s.outcome}|${JSON.stringify(s.postAttrs)}`,
  );
}

export function projectReconstructed(run: ReconstructedRun): readonly string[] {
  return run.steps.map(
    (s) =>
      `${s.index}|${s.fromNode}->${s.toNode}|${s.action.id}|${s.decision}|${s.outcome}|${JSON.stringify(s.postAttrs)}`,
  );
}

/** True iff the reconstructed run replays the original trajectory exactly. */
export function replaysExactly(trajectory: Trajectory, run: ReconstructedRun): boolean {
  const a = projectTrajectory(trajectory);
  const b = projectReconstructed(run);
  return a.length === b.length && a.every((line, i) => line === b[i]);
}
