/**
 * Multi-agent governed orchestration — the substrate behind the console
 * Orchestrator canvas. A workflow is an ordered chain of agents; EACH agent runs
 * as its own governed kernel trajectory under its OWN tier (Θ). The output of one
 * agent is handed off to the next, and the whole chain is fail-closed: if any
 * agent is blocked, escalated, or killed, every downstream agent is contained and
 * nothing is released.
 *
 * Governance is REAL and deterministic, never an annotation:
 *   - the per-agent governance level the UI drags is the agent's Tier → Θ, and it
 *     genuinely changes what the kernel permits (thresholds, containment);
 *   - the kill switch halts an agent and contains everything downstream;
 *   - the decision rationale is read from the kernel's own guard evaluations.
 * The agents' chain-of-thought is ADVISORY ONLY (cotAdvisory) — it never touches
 * the binding path, exactly as the hard constraints require.
 */

import type { Tier, Trajectory } from "@ring-zero/kernel";
import { thetaForTier } from "./tiers.js";
import type { GuardSpec, WorkflowSpec } from "./workflow-spec.js";
import { runWorkflowSpec } from "./workflow-spec.js";

export type GovernanceLevel = Tier;

/** A single agent in the chain — its role, its governed step, and its advisory CoT. */
interface AgentBlueprint {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly defaultTier: GovernanceLevel;
  readonly actionId: string;
  readonly intent: WorkflowSpec["transitions"][number]["action"]["intent"];
  readonly seedAttrs: Record<string, number>;
  readonly seedData?: Record<string, unknown>;
  readonly guard?: GuardSpec | readonly GuardSpec[];
  /** Release-style agents mint an authenticated approval before the binding action. */
  readonly mintsApprovalFirst?: boolean;
  /** Handoff payload emitted to the next agent on a governed pass (telemetry edge). */
  readonly produces: Record<string, unknown>;
  /** Advisory chain-of-thought — NEVER on the binding path. */
  readonly cot: readonly string[];
  /** What raising/lowering this agent's governance level actually does. */
  readonly governanceNote: string;
}

/** The canonical credit-memo multi-agent pipeline (the demo vertical). */
export const CREDIT_MEMO_PIPELINE: { readonly id: string; readonly agents: readonly AgentBlueprint[] } = {
  id: "credit-memo-pipeline",
  agents: [
    {
      id: "intake",
      name: "Intake Agent",
      role: "Parse the credit application packet into structured fields",
      defaultTier: 2,
      actionId: "C1.extract",
      intent: "read",
      seedAttrs: { Alignment: 1, Verified: 1, Confidence: 1, Information: 1, Length: 0 },
      produces: { applicant: "Acme Robotics Pte Ltd", facility: "S$12M revolving", amount: 12_000_000 },
      cot: [
        "Read the application packet and the requested facility.",
        "Normalise applicant identity and facility terms.",
        "Emit structured fields for retrieval — no external data touched yet.",
      ],
      governanceNote: "Low-stakes parsing; passes at any governance level.",
    },
    {
      id: "retrieval",
      name: "Retrieval Agent",
      role: "Pull source financials under an allowlist + recency guard",
      defaultTier: 3,
      actionId: "C2.retrieve",
      intent: "retrieve",
      seedAttrs: { Alignment: 1, Verified: 1, Confidence: 1, Information: 0.9, Length: 0 },
      seedData: { recencyMonths: 12, sourceAllowlisted: true },
      guard: [
        { type: "allowlist", field: "sourceAllowlisted" },
        { type: "recency", field: "recencyMonths", maxMonths: 18 },
      ],
      produces: { financials: "FY24 audited statements", source: "core-banking", recencyMonths: 12 },
      cot: [
        "Locate the latest audited financials for the applicant.",
        "Check the source is on the approved allowlist.",
        "Reject anything older than the recency window.",
      ],
      governanceNote:
        "Source allowlist + 18-month recency are structural guards — stale or off-allowlist data fails closed regardless of level.",
    },
    {
      id: "analysis",
      name: "Analysis Agent",
      role: "Recompute the coverage ratio and verify it deterministically",
      defaultTier: 3,
      actionId: "C3.compute",
      intent: "compute",
      // Verified:0 forces the deterministic verifier to run (the moat). Alignment
      // sits at 0.85: fine at Tier ≤3, but Tier 4 (θ_A=0.9) demands re-grounding the
      // analysis — which this thin agent can't, so it escalates to a human.
      seedAttrs: { Alignment: 0.85, Verified: 0, Confidence: 0.75, Information: 0.9, Length: 0 },
      seedData: {
        _verify: { checks: [{ kind: "numeric", label: "coverage", claimed: 1.82, recomputed: 1.82, tolerance: 0.01 }] },
      },
      produces: { coverageRatio: 1.82, verified: true },
      cot: [
        "Recompute the coverage ratio from the retrieved statements.",
        "Cross-check the claimed figure against the recomputation.",
        "Surface any material discrepancy for escalation.",
      ],
      governanceNote:
        "A deterministic verifier checks the coverage figure. Above Tier 3 the confidence bar rises to 0.8, so the agent escalates to a human.",
    },
    {
      id: "drafting",
      name: "Drafting Agent",
      role: "Compose the memo from verified figures (advisory draft only)",
      defaultTier: 2,
      actionId: "C4.draft",
      intent: "compute",
      seedAttrs: { Alignment: 1, Verified: 1, Confidence: 1, Information: 0.9, Length: 2 },
      produces: { memoDraft: "Credit memo v1 (advisory)" },
      cot: [
        "Compose the memo narrative around verified figures only.",
        "Mark the draft advisory until an authenticated approval exists.",
      ],
      governanceNote: "Drafting is advisory; the LLM draft never binds.",
    },
    {
      id: "release",
      name: "Approval & Release Agent",
      role: "Bind an authenticated approval, then dispatch the memo externally",
      defaultTier: 3,
      actionId: "C4.release",
      intent: "dispatch",
      mintsApprovalFirst: true,
      seedAttrs: { Alignment: 1, Verified: 1, Confidence: 0.75, Information: 0.9, Length: 3 },
      produces: { released: true, dispatchRef: "REL-2026-0042", approver: "risk-officer@bank" },
      cot: [
        "Require an authenticated approval token for this exact memo node.",
        "Reject any verbal or replayed approval — only a minted, signed event binds.",
        "Dispatch to the facility system once Verified=1 and sign-off is authentic.",
      ],
      governanceNote:
        "The kernel blocks any external release without an authenticated sign-off AND Verified=1. At Tier 4 the confidence bar rises to 0.8, so release escalates for human authorisation instead of auto-dispatching.",
    },
  ],
};

/** Scenario injections — each patches a specific agent's seed to simulate an attack. */
export const SCENARIOS = {
  clean: { label: "Clean run", patch: {} as Record<string, Record<string, unknown>> },
  "stale-data": {
    label: "Attack — 26-month-stale financials",
    patch: { retrieval: { recencyMonths: 26 } },
  },
  "off-allowlist": {
    label: "Attack — off-allowlist source",
    patch: { retrieval: { sourceAllowlisted: false } },
  },
  "double-count": {
    label: "Attack — double-counted EBITDA (2.82 vs 1.82)",
    patch: {
      analysis: {
        _verify: { checks: [{ kind: "numeric", label: "coverage", claimed: 2.82, recomputed: 1.82, tolerance: 0.01 }] },
      },
    },
  },
} as const;

export type ScenarioId = keyof typeof SCENARIOS;

export interface OrchestrationOverrides {
  /** Per-agent governance level (Tier → Θ) — the slider the UI drags. */
  readonly tiers?: Readonly<Record<string, GovernanceLevel>>;
  /** Agents the operator has killed — halts them and contains everything downstream. */
  readonly killed?: readonly string[];
  readonly scenario?: ScenarioId;
}

export type AgentStatus = "ok" | "contained" | "blocked" | "killed" | "skipped";

export interface AgentRunResult {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly tier: GovernanceLevel;
  readonly status: AgentStatus;
  readonly terminalKind: string;
  readonly rationale: string;
  readonly cot: readonly string[];
  readonly cotAdvisory: true;
  readonly governanceNote: string;
  /** Concrete Θ this agent ran under — what the governance level resolves to. */
  readonly theta: {
    readonly alignment: number;
    readonly confidence: number;
    readonly containment: string;
    readonly dualApproval: boolean;
    readonly lengthBudget: number;
  };
  /** Real kernel guard evaluations for this agent's binding steps. */
  readonly steps: Trajectory["steps"];
  /** Handoff payload emitted downstream (telemetry edge) — empty if not reached/passed. */
  readonly emitted: Record<string, unknown>;
}

export interface OrchestrationResult {
  readonly workflowId: string;
  readonly scenario: ScenarioId;
  readonly agents: readonly AgentRunResult[];
  readonly released: boolean;
  readonly haltedAt: string | null;
}

function statusFromTerminal(kind: string): "ok" | "contained" | "blocked" {
  if (kind === "Complete") return "ok";
  if (kind === "Escalate") return "contained";
  return "blocked"; // Halt | Abstain
}

function deriveRationale(traj: Trajectory, tier: GovernanceLevel): string {
  const theta = thetaForTier(tier);
  if (traj.terminal.kind === "Complete") {
    const verified = traj.steps.some((s) => s.outcome === "verified");
    const n = traj.steps.length;
    return (
      `Governed pass at Tier ${tier} (θ_A=${theta.thresholds.Alignment}, θ_C=${theta.thresholds.Confidence}). ` +
      `${n} binding step${n === 1 ? "" : "s"}${verified ? ", deterministic verifier passed" : ""}.`
    );
  }
  const last = traj.steps[traj.steps.length - 1];
  const fired = last?.guardEvaluations.find((g) => g.fired);
  const guardLine = fired
    ? ` Decisive guard: ${fired.guard}` +
      (fired.score !== undefined && fired.threshold !== undefined ? ` (${fired.score} vs ${fired.threshold}).` : ".")
    : "";
  const verify = last?.verifyResult ? ` Verifier: ${last.verifyResult.detail}.` : "";
  return `${traj.terminal.kind} at Tier ${tier} — ${traj.terminal.detail}.${guardLine}${verify}`;
}

function buildSpec(
  agent: AgentBlueprint,
  tier: GovernanceLevel,
  carried: Record<string, unknown>,
  patch: Record<string, unknown> | undefined,
): WorkflowSpec {
  const seed = { attrs: agent.seedAttrs, data: { ...carried, ...agent.seedData, ...patch } };

  if (agent.mintsApprovalFirst) {
    // start → approved (mint an authenticated approval) → done (dispatch). The
    // dispatch constraint requires an approval signed for the `approved` node.
    return {
      id: agent.id,
      tier,
      states: [
        { id: "start", initial: true },
        { id: "approved" },
        { id: "done", terminal: true },
      ],
      transitions: [
        { from: "start", to: "approved", action: { id: "approve", intent: "control", kind: "control" }, effect: { flags: { mintApproval: true } } },
        { from: "approved", to: "done", action: { id: agent.actionId, intent: agent.intent }, ...(agent.guard ? { guard: agent.guard } : {}) },
      ],
      seed,
    };
  }

  return {
    id: agent.id,
    tier,
    states: [
      { id: "start", initial: true },
      { id: "done", terminal: true },
    ],
    transitions: [
      {
        from: "start",
        to: "done",
        action: { id: agent.actionId, intent: agent.intent },
        ...(agent.guard ? { guard: agent.guard } : {}),
      },
    ],
    seed,
  };
}

/**
 * Run the multi-agent workflow under the given per-agent governance overrides.
 * Deterministic and fail-closed: a blocked / escalated / killed agent contains
 * every agent after it.
 */
export function runOrchestration(overrides: OrchestrationOverrides = {}): OrchestrationResult {
  const scenario: ScenarioId = overrides.scenario ?? "clean";
  const patches: Record<string, Record<string, unknown>> = SCENARIOS[scenario].patch;
  const killed = new Set(overrides.killed ?? []);

  const agents: AgentRunResult[] = [];
  let carried: Record<string, unknown> = {};
  let haltedAt: string | null = null;

  for (const bp of CREDIT_MEMO_PIPELINE.agents) {
    const tier = overrides.tiers?.[bp.id] ?? bp.defaultTier;
    const theta = thetaForTier(tier);
    const thetaSummary = {
      alignment: theta.thresholds.Alignment,
      confidence: theta.thresholds.Confidence,
      containment: theta.defaultContainment,
      dualApproval: theta.requireDualApproval,
      lengthBudget: theta.Lmax,
    };

    // Fail-closed: once the chain has halted, everything downstream is skipped.
    if (haltedAt) {
      agents.push({
        id: bp.id, name: bp.name, role: bp.role, tier, status: "skipped",
        terminalKind: "—", rationale: `Not reached — contained because ${haltedAt} halted upstream (fail-closed).`,
        cot: bp.cot, cotAdvisory: true, governanceNote: bp.governanceNote, theta: thetaSummary, steps: [], emitted: {},
      });
      continue;
    }

    // Operator kill switch.
    if (killed.has(bp.id)) {
      agents.push({
        id: bp.id, name: bp.name, role: bp.role, tier, status: "killed",
        terminalKind: "Killed", rationale: "Operator kill switch engaged — agent halted; downstream contained (fail-closed).",
        cot: bp.cot, cotAdvisory: true, governanceNote: bp.governanceNote, theta: thetaSummary, steps: [], emitted: {},
      });
      haltedAt = bp.name;
      continue;
    }

    const spec = buildSpec(bp, tier, carried, patches[bp.id]);
    const traj = runWorkflowSpec(spec);
    const status = statusFromTerminal(traj.terminal.kind);
    const emitted = status === "ok" ? bp.produces : {};

    agents.push({
      id: bp.id, name: bp.name, role: bp.role, tier, status,
      terminalKind: traj.terminal.kind, rationale: deriveRationale(traj, tier),
      cot: bp.cot, cotAdvisory: true, governanceNote: bp.governanceNote, theta: thetaSummary,
      steps: traj.steps, emitted,
    });

    if (status === "ok") {
      carried = { ...carried, ...bp.produces };
    } else {
      haltedAt = bp.name;
    }
  }

  const release = agents.find((a) => a.id === "release");
  const released = release?.status === "ok";
  return { workflowId: CREDIT_MEMO_PIPELINE.id, scenario, agents, released, haltedAt };
}
