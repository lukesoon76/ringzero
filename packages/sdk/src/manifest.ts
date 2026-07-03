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
  readonly tools: ReadonlyArray<{ readonly id: string; readonly intent: "read" | "retrieve" | "compute" | "write" | "dispatch" }>;
  readonly models: readonly string[];
  readonly dataSources: readonly string[];
  readonly autonomy: { readonly canDispatchExternally: boolean; readonly scopes: readonly string[] };
  readonly enforcement: { readonly mode: EnforcementMode; readonly bindable: boolean; readonly via: string };
  readonly nodes: readonly ManifestNode[];
  readonly edges: readonly ManifestEdge[];
  readonly riskSignals: RiskSignals;
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
