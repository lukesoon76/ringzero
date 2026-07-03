/**
 * The canonical, platform-agnostic agent representation — the contract every
 * discovery connector normalises onto, so an agent built on AWS Bedrock, Azure
 * AI, Salesforce Agentforce, SAP Joule, or a raw LangGraph repo all become the
 * SAME governed object under one control plane.
 *
 * `detect` (connectors) and `govern` (kernel) are decoupled by this manifest:
 * connectors are the only platform-specific code; the kernel never changes.
 */

export type AgentSource =
  | "aws-bedrock"
  | "azure-ai-agents"
  | "salesforce-agentforce"
  | "sap-joule"
  | "code-scan"
  | "otel-egress";

/** How the agent was found. */
export type DiscoveryChannel = "control-plane" | "runtime" | "code";

/**
 * How Regent can enforce on this agent:
 *  - inline  : Regent sits in the call path (MCP/tool gateway, proxy, SDK middleware) → BINDING, deterministic
 *  - native  : Regent policy compiled to the platform's own guardrail            → binding at the platform
 *  - observe : Regent ingests traces/logs and governs post-hoc                   → advisory / detective
 */
export type EnforcementMode = "inline" | "native" | "observe";

export interface ManifestNode {
  readonly id: string;
  readonly name: string;
  readonly kind: "agent" | "tool" | "model" | "knowledge";
}
export interface ManifestEdge {
  readonly from: string;
  readonly to: string;
}

/** 0–3 per dimension — feeds Regent's P2 risk tiering directly. */
export interface RiskSignals {
  readonly agency: number;
  readonly authority: number;
  readonly impact: number;
  readonly exposure: number;
  readonly recoverability: number;
}

/** MAS AI RG inventory metadata common to every AI asset. */
export type LifecycleStage = "intake" | "development" | "validation" | "deployed" | "retired";
export type ModelKind = "foundation" | "embedding" | "classical-ml";
export interface ThirdParty {
  readonly provider: string;
  readonly contract?: string;
}

/* --------------------------------------------------------------------------
 * Governance superset (MAS AI Model Risk Management / FEAT / MGF aligned).
 * Additive over the fields above — reconciled from a parallel-session schema.
 * The AGENT stays the top-level unit; sub-assets are typed refs it carries, so
 * P1 inventory doubles as the P6 attestation source (see attestation.ts).
 * ------------------------------------------------------------------------ */

export type DataSensitivity = "public" | "internal" | "confidential" | "pii" | "restricted";
export type MaterialityTier = 1 | 2 | 3 | 4;

/** Named accountable ownership (FEAT: a person is accountable, not just a team). */
export interface Accountability {
  readonly owner: string;
  readonly accountableOfficer?: string;
  readonly validator?: string;
}

/** A framework clause a bound control evidences. `framework` is a library id (e.g. "eu-ai-act"). */
export interface FrameworkMapping {
  readonly framework: string;
  readonly clause: string;
}

/**
 * A control bound to the asset. `strength` is the moat: deterministic controls
 * BIND; advisory (LLM/embedding judge) and detective (post-hoc) NEVER bind — they
 * only ever support an attestation as non-authoritative evidence.
 */
export interface BoundControl {
  readonly id: string;
  readonly kind: "guardrail" | "policy" | "verifier" | "human-oversight" | "containment";
  readonly label: string;
  readonly strength: "deterministic" | "advisory" | "detective";
  readonly satisfies: readonly FrameworkMapping[];
}

/** A tool + its GRANT — inventory the blast radius, not just the tool (P7). */
export interface ToolGrant {
  readonly id: string;
  readonly intent: "read" | "retrieve" | "compute" | "write" | "dispatch";
  readonly scopes?: readonly string[];
  readonly egress?: boolean;
  readonly leastPrivilegeVerified?: boolean;
}

/** A model reference — versioned, provider-attributed, vendor-flagged (SR 11-7). */
export interface ModelRef {
  readonly id: string;
  readonly role: "generative" | "embedding" | "classifier" | "judge";
  readonly provider: string;
  readonly version?: string;
  readonly thirdParty: boolean;
  /** A judge model is ADVISORY only on the binding path (hard constraint). */
  readonly bindingRole: "none" | "advisory";
}

/** A knowledge/dataset reference with the field people miss: the recency SLA. */
export interface DataSourceRef {
  readonly id: string;
  readonly class: "knowledge" | "dataset-training" | "dataset-validation" | "dataset-reference";
  readonly sensitivity: DataSensitivity;
  readonly residency?: string;
  /** Max tolerated staleness (months). Lets P4 enforce and P6 attest the stale-data attack. */
  readonly recencySlaMonths?: number;
  readonly provenance?: string;
}

/** A human oversight gate (MGF human accountability; EU AI Act Art. 14). */
export interface OversightGate {
  readonly id: string;
  readonly stage: string;
  readonly authorisedRole: string;
  readonly mode: "blocking" | "advisory";
}

export interface AgentManifest {
  readonly id: string;
  readonly name: string;
  readonly source: AgentSource;
  readonly externalRef: string;
  readonly discoveredVia: DiscoveryChannel;
  readonly runtime: { readonly platform: string; readonly region?: string; readonly tenant?: string };
  readonly owner: string;
  // MAS AI RG inventory metadata
  readonly purpose: string;
  readonly skills: readonly string[];
  readonly dataCategories: readonly string[];
  readonly lifecycleStage: LifecycleStage;
  readonly materiality: { readonly tierRationale: string };
  readonly thirdParty?: ThirdParty;
  /** Tools + grants. `id`/`intent` are back-compat; scopes/egress/leastPrivilege are additive. */
  readonly tools: readonly ToolGrant[];
  readonly models: readonly string[];
  readonly dataSources: readonly string[];
  readonly autonomy: { readonly canDispatchExternally: boolean; readonly scopes: readonly string[] };
  readonly enforcement: { readonly mode: EnforcementMode; readonly bindable: boolean; readonly via: string };
  readonly nodes: readonly ManifestNode[];
  readonly edges: readonly ManifestEdge[];
  readonly riskSignals: RiskSignals;

  /* --- governance superset (all additive/optional; feeds attestation) --- */
  /** Named accountable ownership (kept alongside flat `owner` for back-compat). */
  readonly accountability?: Accountability;
  /** Stored materiality outcome (not just derived from riskSignals). */
  readonly materialityTier?: MaterialityTier;
  /** Controls bound to this asset — the attestation source. */
  readonly controls?: readonly BoundControl[];
  /** Typed model refs (richer than the flat `models: string[]`, which stays for back-compat). */
  readonly modelRefs?: readonly ModelRef[];
  /** Typed data-source refs incl. recency SLA (richer than flat `dataSources: string[]`). */
  readonly dataSourceRefs?: readonly DataSourceRef[];
  /** Human oversight gates (MGF / EU AI Act Art. 14). */
  readonly humanOversight?: readonly OversightGate[];
  /** ISO-8601 inventory-freshness stamp (caller-supplied; never minted here). */
  readonly lastDiscoveredAt?: string;
}

/** A model asset (foundation or classical ML) — the non-agentic half of the inventory. */
export interface ModelManifest {
  readonly id: string;
  readonly name: string;
  readonly kind: ModelKind;
  readonly provider: string;
  readonly hostedOn: string;
  readonly externalRef: string;
  readonly owner: string;
  readonly purpose: string;
  readonly dataCategories: readonly string[];
  readonly lifecycleStage: LifecycleStage;
  readonly thirdParty?: ThirdParty;
  readonly riskSignals: RiskSignals;
  readonly usedByAgents: readonly string[];
}

/** A connector detects agents on one platform and normalises them to manifests. */
export interface DiscoveryConnector {
  readonly source: AgentSource;
  readonly label: string;
  /** How this connector finds agents (control-plane API, runtime telemetry, code scan). */
  readonly channel: DiscoveryChannel;
  /** In a live deployment this calls the platform API; here it returns normalised fixtures. */
  discover(): readonly AgentManifest[];
}

export const SOURCE_LABEL: Record<AgentSource, string> = {
  "aws-bedrock": "AWS Bedrock",
  "azure-ai-agents": "Azure AI",
  "salesforce-agentforce": "Salesforce Agentforce",
  "sap-joule": "SAP Joule",
  "code-scan": "Code scan",
  "otel-egress": "OTel egress",
};
