/**
 * Multi-agent governed orchestration — the substrate behind the console
 * Orchestrator studio. A workflow is an ordered chain of agents; EACH agent runs
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
 *
 * Two example verticals ship: a credit-memo pipeline and an insurance-claims
 * pipeline. Both reuse the identical governance mechanics.
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
  /** Upstream agents that must all pass before this one runs. Defaults to the previous agent (linear chain). */
  readonly dependsOn?: readonly string[];
  /** Marks an agent that reads the shared knowledge base (drawn as a reference edge). */
  readonly readsKnowledge?: boolean;
  /** Explicit canvas position; otherwise auto-laid-out left-to-right by index. */
  readonly pos?: { readonly x: number; readonly y: number };
  /** Handoff payload emitted to the next agent on a governed pass (telemetry edge). */
  readonly produces: Record<string, unknown>;
  /** Advisory chain-of-thought — NEVER on the binding path. */
  readonly cot: readonly string[];
  /** What raising/lowering this agent's governance level actually does. */
  readonly governanceNote: string;
}

interface ScenarioDef {
  readonly label: string;
  readonly patch: Record<string, Record<string, unknown>>;
}

export interface Pipeline {
  readonly id: string;
  readonly label: string;
  readonly vertical: string;
  readonly agents: readonly AgentBlueprint[];
  readonly scenarios: Record<string, ScenarioDef>;
  /** Optional shared knowledge base feeding `readsKnowledge` agents (reference edges). */
  readonly knowledgeBase?: {
    readonly id: string;
    readonly label: string;
    readonly documents: readonly string[];
    readonly pos: { readonly x: number; readonly y: number };
  };
}

/* ------------------------------------------------------------------ */
/* Pipeline 1 — credit memo (regulated lending)                        */
/* ------------------------------------------------------------------ */

const CREDIT_MEMO_PIPELINE: Pipeline = {
  id: "credit-memo",
  label: "Credit-Memo Pipeline",
  vertical: "Regulated lending",
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
  scenarios: {
    clean: { label: "Clean run", patch: {} },
    "stale-data": { label: "Attack — 26-month-stale financials", patch: { retrieval: { recencyMonths: 26 } } },
    "off-allowlist": { label: "Attack — off-allowlist source", patch: { retrieval: { sourceAllowlisted: false } } },
    "double-count": {
      label: "Attack — double-counted EBITDA (2.82 vs 1.82)",
      patch: {
        analysis: {
          _verify: { checks: [{ kind: "numeric", label: "coverage", claimed: 2.82, recomputed: 1.82, tolerance: 0.01 }] },
        },
      },
    },
  },
};

/* ------------------------------------------------------------------ */
/* Pipeline 2 — insurance claims (regulated insurance)                 */
/* ------------------------------------------------------------------ */

const INSURANCE_CLAIMS_PIPELINE: Pipeline = {
  id: "insurance-claims",
  label: "Insurance Claims Pipeline",
  vertical: "Regulated insurance",
  agents: [
    {
      id: "fnol",
      name: "FNOL Intake Agent",
      role: "Capture the first notice of loss and structure the claim",
      defaultTier: 2,
      actionId: "C1.capture",
      intent: "read",
      seedAttrs: { Alignment: 1, Verified: 1, Confidence: 1, Information: 1, Length: 0 },
      produces: { claimant: "J. Tan", policyNo: "MOT-44821", lossType: "motor collision", claimed: 12_000 },
      cot: [
        "Capture the first notice of loss (date, peril, parties).",
        "Normalise the policy number and loss type.",
        "Emit a structured claim for policy verification — no payout logic yet.",
      ],
      governanceNote: "Low-stakes intake; passes at any governance level.",
    },
    {
      id: "policy",
      name: "Policy Verification Agent",
      role: "Confirm the policy is in force and the loss is covered",
      defaultTier: 3,
      actionId: "C2.policy-check",
      intent: "retrieve",
      seedAttrs: { Alignment: 1, Verified: 1, Confidence: 1, Information: 0.9, Length: 0 },
      seedData: { policyInForce: true, policyAgeMonths: 8 },
      guard: [
        { type: "allowlist", field: "policyInForce" },
        { type: "recency", field: "policyAgeMonths", maxMonths: 24 },
      ],
      produces: { coverage: "comprehensive", inForce: true, deductible: 500 },
      cot: [
        "Pull the policy of record and confirm it is in force on the loss date.",
        "Check the peril is covered and within the policy term.",
        "Reject lapsed or out-of-term policies.",
      ],
      governanceNote:
        "In-force + 24-month policy-of-record recency are structural guards — a lapsed or stale policy fails closed regardless of level.",
    },
    {
      id: "fraud",
      name: "Fraud Detection Agent",
      role: "Score fraud risk and verify the claimed loss against the assessment",
      defaultTier: 3,
      actionId: "C3.fraud-score",
      intent: "compute",
      seedAttrs: { Alignment: 0.85, Verified: 0, Confidence: 0.75, Information: 0.9, Length: 0 },
      seedData: {
        _verify: { checks: [{ kind: "numeric", label: "assessed-loss", claimed: 12_000, recomputed: 12_000, tolerance: 50 }] },
      },
      produces: { fraudScore: 0.12, lossVerified: true },
      cot: [
        "Score fraud indicators against the claim profile.",
        "Verify the claimed loss against the independent damage assessment.",
        "Escalate any material gap between claimed and assessed loss.",
      ],
      governanceNote:
        "A deterministic verifier checks the claimed loss against the assessment. Above Tier 3 the agent must re-ground its score, and escalates to a human adjuster.",
    },
    {
      id: "adjudication",
      name: "Adjudication Agent",
      role: "Decide the payout within policy limits and deductible",
      defaultTier: 2,
      actionId: "C4.adjudicate",
      intent: "compute",
      seedAttrs: { Alignment: 1, Verified: 1, Confidence: 1, Information: 0.9, Length: 2 },
      produces: { payout: 11_500, withinLimit: true },
      cot: [
        "Apply policy limits and deductible to the verified loss.",
        "Compute the net payable amount.",
        "Hold the figure advisory until settlement is authorised.",
      ],
      governanceNote: "Adjudication is advisory; the computed payout never binds without authorised settlement.",
    },
    {
      id: "settlement",
      name: "Settlement Agent",
      role: "Authorise and disburse the payout to the claimant externally",
      defaultTier: 3,
      actionId: "C4.disburse",
      intent: "dispatch",
      mintsApprovalFirst: true,
      seedAttrs: { Alignment: 1, Verified: 1, Confidence: 0.75, Information: 0.9, Length: 3 },
      produces: { disbursed: true, paymentRef: "PAY-2026-7781", approver: "claims-officer@insurer" },
      cot: [
        "Require an authenticated settlement approval for this exact claim node.",
        "Reject any verbal or replayed authorisation — only a minted, signed event binds.",
        "Disburse to the claimant once Verified=1 and sign-off is authentic.",
      ],
      governanceNote:
        "The kernel blocks any external disbursement without an authenticated sign-off AND Verified=1. At Tier 4 the confidence bar rises to 0.8, so settlement escalates for human authorisation instead of auto-paying.",
    },
  ],
  scenarios: {
    clean: { label: "Clean run", patch: {} },
    "stale-policy": { label: "Attack — 40-month-stale policy of record", patch: { policy: { policyAgeMonths: 40 } } },
    "lapsed-policy": { label: "Attack — lapsed policy (not in force)", patch: { policy: { policyInForce: false } } },
    "inflated-claim": {
      label: "Attack — inflated claim (28k claimed vs 12k assessed)",
      patch: {
        fraud: {
          _verify: { checks: [{ kind: "numeric", label: "assessed-loss", claimed: 28_000, recomputed: 12_000, tolerance: 50 }] },
        },
      },
    },
  },
};

/* ------------------------------------------------------------------ */
/* Pipeline 3 — claims fraud (fan-out / fan-in, shared knowledge base)  */
/*   Claims extractor → {treatment, duration, non-coverable} checks     */
/*   (each reading a knowledge base) → output consolidator.             */
/* ------------------------------------------------------------------ */

const CLAIMS_FRAUD_PIPELINE: Pipeline = {
  id: "claims-fraud",
  label: "Claims Fraud Pipeline",
  vertical: "Insurance claims (fraud)",
  knowledgeBase: {
    id: "kb",
    label: "Knowledge base — reference documents",
    documents: ["Claimant policy documents", "Treatment guidelines", "Exclusions schedule"],
    pos: { x: 360, y: -190 },
  },
  agents: [
    {
      id: "extractor",
      name: "Claims Extractor & Formatter",
      role: "Parse claims and PDFs into structured data",
      defaultTier: 2,
      actionId: "C1.extract",
      intent: "read",
      dependsOn: [],
      pos: { x: 0, y: 200 },
      seedAttrs: { Alignment: 1, Verified: 1, Confidence: 1, Information: 1, Length: 0 },
      produces: { claim: "CLM-88231", lineItems: 7, structured: true },
      cot: [
        "Parse the claim form and attached PDFs.",
        "Normalise diagnosis, treatments, dates, and amounts.",
        "Emit one structured record per claim line for the checks.",
      ],
      governanceNote: "Low-stakes parsing; passes at any governance level.",
    },
    {
      id: "treatment",
      name: "Treatment Validity Check",
      role: "Verify treatments are medically appropriate for the diagnosis",
      defaultTier: 3,
      actionId: "C3.treatment",
      intent: "compute",
      dependsOn: ["extractor"],
      readsKnowledge: true,
      pos: { x: 360, y: 40 },
      // verifier checks the claimed treatment cost against the assessed cost.
      seedAttrs: { Alignment: 0.85, Verified: 0, Confidence: 0.78, Information: 0.9, Length: 0 },
      seedData: {
        _verify: { checks: [{ kind: "numeric", label: "treatment-cost", claimed: 4200, recomputed: 4200, tolerance: 25 }] },
      },
      produces: { treatment: "appropriate", verdict: "Passed (No Fraud)" },
      cot: [
        "Cross-check claimed treatments against the diagnosis and guidelines.",
        "Verify the claimed treatment cost against the assessed cost.",
        "Flag medically inconsistent or inflated treatments as Fraud.",
      ],
      governanceNote:
        "A deterministic verifier checks the claimed treatment cost against the knowledge base. Above Tier 3 the agent must re-ground and escalates to a human assessor.",
    },
    {
      id: "duration",
      name: "Hospitalisation Duration Check",
      role: "Assess whether the claimed length of stay is reasonable",
      defaultTier: 3,
      actionId: "C3.duration",
      intent: "compute",
      dependsOn: ["extractor"],
      readsKnowledge: true,
      pos: { x: 360, y: 200 },
      seedAttrs: { Alignment: 1, Verified: 1, Confidence: 0.78, Information: 0.9, Length: 0 },
      produces: { duration: "within typical range", verdict: "Passed (No Fraud)" },
      cot: [
        "Compare the claimed length of stay to typical stays for the condition.",
        "Reference the treatment guidelines in the knowledge base.",
        "Flag stays materially longer than expected as Fraud.",
      ],
      governanceNote: "Above Tier 3 the confidence bar rises to 0.8, so an uncertain duration assessment escalates to a human.",
    },
    {
      id: "noncoverable",
      name: "Non-coverable Items Check",
      role: "Identify claim items excluded by the policy",
      defaultTier: 3,
      actionId: "C2.exclusions",
      intent: "retrieve",
      dependsOn: ["extractor"],
      readsKnowledge: true,
      pos: { x: 360, y: 360 },
      seedAttrs: { Alignment: 1, Verified: 1, Confidence: 1, Information: 0.9, Length: 0 },
      seedData: { onPolicy: true, policyAgeMonths: 10 },
      guard: [
        { type: "allowlist", field: "onPolicy" },
        { type: "recency", field: "policyAgeMonths", maxMonths: 24 },
      ],
      produces: { exclusions: "none found", verdict: "Passed (No Fraud)" },
      cot: [
        "Retrieve the policy exclusions schedule from the knowledge base.",
        "Match each claim line against excluded items.",
        "Flag reimbursement of excluded items as Fraud.",
      ],
      governanceNote:
        "In-force policy + 24-month recency are structural guards — a lapsed or stale policy of record fails closed regardless of level.",
    },
    {
      id: "consolidator",
      name: "Output Consolidator",
      role: "Aggregate the three checks into an overall result + justification",
      defaultTier: 3,
      actionId: "C4.consolidate",
      intent: "compute",
      dependsOn: ["treatment", "duration", "noncoverable"],
      pos: { x: 760, y: 200 },
      seedAttrs: { Alignment: 1, Verified: 1, Confidence: 1, Information: 0.9, Length: 1 },
      produces: { result: "Passed (No Fraud)", justification: "all three checks cleared" },
      cot: [
        "Collect the verdict and justification from each check.",
        "Apply the consolidation rule (any Fraud ⇒ overall Fraud).",
        "Emit the overall result with a per-item justification.",
      ],
      governanceNote: "Only runs once all three checks have passed governance — any contained check fails the consolidation closed.",
    },
  ],
  scenarios: {
    clean: { label: "Clean run — Passed (No Fraud)", patch: {} },
    "inflated-treatment": {
      label: "Fraud — inflated treatment cost (8.8k vs 4.2k)",
      patch: {
        treatment: {
          _verify: { checks: [{ kind: "numeric", label: "treatment-cost", claimed: 8800, recomputed: 4200, tolerance: 25 }] },
        },
      },
    },
    "stale-policy": { label: "Attack — 40-month-stale policy of record", patch: { noncoverable: { policyAgeMonths: 40 } } },
    "lapsed-policy": { label: "Attack — lapsed policy (not in force)", patch: { noncoverable: { onPolicy: false } } },
  },
};

export const PIPELINES: Record<string, Pipeline> = {
  [CREDIT_MEMO_PIPELINE.id]: CREDIT_MEMO_PIPELINE,
  [INSURANCE_CLAIMS_PIPELINE.id]: INSURANCE_CLAIMS_PIPELINE,
  [CLAIMS_FRAUD_PIPELINE.id]: CLAIMS_FRAUD_PIPELINE,
};
export const DEFAULT_PIPELINE = CREDIT_MEMO_PIPELINE.id;

/** Lightweight manifest for the UI — pipelines, scenarios, default tiers, and topology. */
export interface PipelineNode {
  readonly id: string;
  readonly name: string;
  readonly kind: "agent" | "knowledge";
  readonly pos: { readonly x: number; readonly y: number };
  readonly defaultTier?: number;
  readonly documents?: readonly string[];
}
export interface PipelineEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: "flow" | "reference";
}
export interface PipelineManifest {
  readonly id: string;
  readonly label: string;
  readonly vertical: string;
  readonly scenarios: ReadonlyArray<{ readonly id: string; readonly label: string }>;
  readonly agents: ReadonlyArray<{ readonly id: string; readonly name: string; readonly defaultTier: number }>;
  readonly nodes: readonly PipelineNode[];
  readonly edges: readonly PipelineEdge[];
}

function depsOf(a: AgentBlueprint, prev: string | null): readonly string[] {
  return a.dependsOn ?? (prev ? [prev] : []);
}

export function listPipelines(): PipelineManifest[] {
  return Object.values(PIPELINES).map((p) => {
    const nodes: PipelineNode[] = p.agents.map((a, i) => ({
      id: a.id,
      name: a.name,
      kind: "agent",
      pos: a.pos ?? { x: i * 285, y: i % 2 === 0 ? 140 : 0 },
      defaultTier: a.defaultTier,
    }));
    const edges: PipelineEdge[] = [];
    let prev: string | null = null;
    for (const a of p.agents) {
      for (const d of depsOf(a, prev)) edges.push({ from: d, to: a.id, kind: "flow" });
      prev = a.id;
    }
    if (p.knowledgeBase) {
      nodes.push({ id: p.knowledgeBase.id, name: p.knowledgeBase.label, kind: "knowledge", pos: p.knowledgeBase.pos, documents: p.knowledgeBase.documents });
      for (const a of p.agents) if (a.readsKnowledge) edges.push({ from: p.knowledgeBase.id, to: a.id, kind: "reference" });
    }
    return {
      id: p.id,
      label: p.label,
      vertical: p.vertical,
      scenarios: Object.entries(p.scenarios).map(([id, s]) => ({ id, label: s.label })),
      agents: p.agents.map((a) => ({ id: a.id, name: a.name, defaultTier: a.defaultTier })),
      nodes,
      edges,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

export interface OrchestrationOverrides {
  /** Which workflow to run (defaults to credit-memo). */
  readonly pipeline?: string;
  /** Per-agent governance level (Tier → Θ) — the slider the UI drags. */
  readonly tiers?: Readonly<Record<string, GovernanceLevel>>;
  /** Agents the operator has killed — halts them and contains everything downstream. */
  readonly killed?: readonly string[];
  readonly scenario?: string;
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
  readonly theta: {
    readonly alignment: number;
    readonly confidence: number;
    readonly containment: string;
    readonly dualApproval: boolean;
    readonly lengthBudget: number;
  };
  readonly steps: Trajectory["steps"];
  readonly emitted: Record<string, unknown>;
}

export interface OrchestrationResult {
  readonly pipeline: string;
  readonly scenario: string;
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
 * Run the selected multi-agent workflow under the given per-agent governance
 * overrides. Deterministic and fail-closed: a blocked / escalated / killed agent
 * contains every agent after it.
 */
export function runOrchestration(overrides: OrchestrationOverrides = {}): OrchestrationResult {
  const pipeline = PIPELINES[overrides.pipeline ?? DEFAULT_PIPELINE] ?? PIPELINES[DEFAULT_PIPELINE]!;
  const scenario = pipeline.scenarios[overrides.scenario ?? "clean"] ? (overrides.scenario ?? "clean") : "clean";
  const patches: Record<string, Record<string, unknown>> = pipeline.scenarios[scenario]!.patch;
  const killed = new Set(overrides.killed ?? []);

  const agents: AgentRunResult[] = [];
  const statusById: Record<string, AgentStatus> = {};
  const producesById: Record<string, Record<string, unknown>> = {};
  let prevId: string | null = null;
  let haltedAt: string | null = null;

  for (const bp of pipeline.agents) {
    const tier = overrides.tiers?.[bp.id] ?? bp.defaultTier;
    const theta = thetaForTier(tier);
    const thetaSummary = {
      alignment: theta.thresholds.Alignment,
      confidence: theta.thresholds.Confidence,
      containment: theta.defaultContainment,
      dualApproval: theta.requireDualApproval,
      lengthBudget: theta.Lmax,
    };
    const deps = bp.dependsOn ?? (prevId ? [prevId] : []);
    prevId = bp.id;
    const base = {
      id: bp.id, name: bp.name, role: bp.role, tier,
      cot: bp.cot, cotAdvisory: true as const, governanceNote: bp.governanceNote, theta: thetaSummary,
    };

    // Operator kill switch.
    if (killed.has(bp.id)) {
      statusById[bp.id] = "killed";
      if (!haltedAt) haltedAt = bp.name;
      agents.push({ ...base, status: "killed", terminalKind: "Killed", rationale: "Operator kill switch engaged — agent halted; dependents contained (fail-closed).", steps: [], emitted: {} });
      continue;
    }

    // Fail-closed: skip if any dependency did not pass governance.
    const blocker = deps.find((d) => statusById[d] !== "ok");
    if (blocker) {
      statusById[bp.id] = "skipped";
      agents.push({ ...base, status: "skipped", terminalKind: "—", rationale: `Not reached — upstream "${blocker}" did not pass (fail-closed).`, steps: [], emitted: {} });
      continue;
    }

    const carried = Object.assign({}, ...deps.map((d) => producesById[d] ?? {})) as Record<string, unknown>;
    const traj = runWorkflowSpec(buildSpec(bp, tier, carried, patches[bp.id]));
    const status = statusFromTerminal(traj.terminal.kind);
    statusById[bp.id] = status;
    if (status === "ok") producesById[bp.id] = bp.produces;
    else if (!haltedAt) haltedAt = bp.name;

    agents.push({
      ...base, status, terminalKind: traj.terminal.kind, rationale: deriveRationale(traj, tier),
      steps: traj.steps, emitted: status === "ok" ? bp.produces : {},
    });
  }

  const last = pipeline.agents[pipeline.agents.length - 1];
  const released = last ? statusById[last.id] === "ok" : false;
  return { pipeline: pipeline.id, scenario, agents, released, haltedAt };
}
