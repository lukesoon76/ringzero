/**
 * Discovery connectors — one per platform. Each maps its platform's native shape
 * onto the canonical AgentManifest (agents) and ModelManifest (models), carrying
 * the MAS AI RG inventory metadata AND the governance superset (tool grants,
 * typed model/data refs with recency SLAs, stored materiality tier, named
 * accountability, and BOUND CONTROLS with framework mappings — the attestation
 * source). In production `discover()` calls the platform's API / telemetry; here
 * they return representative fixtures.
 */

import type { AgentManifest, DiscoveryConnector, ModelManifest } from "./manifest.js";

const SWEPT = "2026-07-03T00:00:00Z";

const awsBedrock: DiscoveryConnector = {
  source: "aws-bedrock",
  label: "AWS Bedrock Agents",
  channel: "control-plane",
  discover: () => [
    {
      id: "aws-bedrock:loan-underwriter",
      name: "Loan Underwriting Agent",
      source: "aws-bedrock",
      externalRef: "arn:aws:bedrock:us-east-1:acct:agent/AGENT123",
      discoveredVia: "control-plane",
      runtime: { platform: "AWS Bedrock AgentCore", region: "us-east-1" },
      owner: "Credit Risk",
      purpose: "Automate credit underwriting decisions from application packets",
      skills: ["application-extract", "risk-scoring", "decisioning"],
      dataCategories: ["PII", "financials"],
      lifecycleStage: "deployed",
      materiality: { tierRationale: "High — autonomous credit decisions with external dispatch and customer impact" },
      thirdParty: { provider: "AWS Bedrock (Anthropic)", contract: "AWS EA" },
      tools: [
        { id: "kb-retrieve", intent: "retrieve", scopes: ["kb:read"], egress: false, leastPrivilegeVerified: true },
        { id: "score-lambda", intent: "compute", scopes: ["lambda:invoke"], egress: false, leastPrivilegeVerified: true },
        { id: "decision-api", intent: "dispatch", scopes: ["decision:write"], egress: true, leastPrivilegeVerified: true },
      ],
      models: ["anthropic.claude-3-5-sonnet", "amazon.titan-embed"],
      dataSources: ["Bedrock Knowledge Base: credit-policy"],
      autonomy: { canDispatchExternally: true, scopes: ["kb:read", "lambda:invoke", "decision:write"] },
      enforcement: { mode: "inline", bindable: true, via: "Regent MCP gateway (or Bedrock Guardrails)" },
      nodes: [
        { id: "extract", name: "Application Extract", kind: "agent" },
        { id: "kb", name: "Credit KB", kind: "knowledge" },
        { id: "score", name: "Risk Scoring", kind: "agent" },
        { id: "decide", name: "Decision Dispatch", kind: "tool" },
      ],
      edges: [
        { from: "extract", to: "score" },
        { from: "kb", to: "score" },
        { from: "score", to: "decide" },
      ],
      riskSignals: { agency: 3, authority: 3, impact: 3, exposure: 2, recoverability: 2 },
      materialityTier: 4,
      accountability: { owner: "Credit Risk", accountableOfficer: "Head of Credit Risk", validator: "Model Risk (2LoD)" },
      modelRefs: [
        { id: "anthropic.claude-3-5-sonnet", role: "generative", provider: "Anthropic", version: "20241022", thirdParty: true, bindingRole: "none" },
        { id: "amazon.titan-embed", role: "embedding", provider: "AWS", thirdParty: true, bindingRole: "none" },
      ],
      dataSourceRefs: [
        { id: "Bedrock Knowledge Base: credit-policy", class: "knowledge", sensitivity: "confidential", residency: "us-east-1", recencySlaMonths: 24, provenance: "core-banking" },
      ],
      controls: [
        { id: "c-verify", kind: "verifier", label: "Deterministic coverage-ratio verification", strength: "deterministic", satisfies: [{ framework: "mas-ai-rg", clause: "monitoring" }, { framework: "eu-ai-act", clause: "art15" }, { framework: "nist-ai-rmf", clause: "measure" }] },
        { id: "c-approval", kind: "human-oversight", label: "Authenticated human approval before release", strength: "deterministic", satisfies: [{ framework: "eu-ai-act", clause: "art14" }, { framework: "sg-mgf", clause: "human-accountability" }] },
        { id: "c-log", kind: "policy", label: "Replayable trace log", strength: "deterministic", satisfies: [{ framework: "eu-ai-act", clause: "art12" }, { framework: "iso-42001", clause: "records" }] },
        { id: "c-recency", kind: "guardrail", label: "Data-recency ≤ 24 months", strength: "deterministic", satisfies: [{ framework: "mas-ai-rg", clause: "development" }] },
        { id: "c-fairness", kind: "guardrail", label: "Fairness monitor", strength: "advisory", satisfies: [{ framework: "mas-feat", clause: "fairness" }] },
        // Financial runtime controls (SAFR) — deterministic, enforced inline via the MCP gateway.
        { id: "c-fin-scope", kind: "guardrail", label: "Financial scope boundary", strength: "deterministic", satisfies: [{ framework: "mas-safr", clause: "scope-mandate" }] },
        { id: "c-fin-materiality", kind: "human-oversight", label: "Materiality human-in-the-loop", strength: "deterministic", satisfies: [{ framework: "mas-safr", clause: "materiality-gating" }] },
        { id: "c-fin-exposure", kind: "containment", label: "Cumulative session-exposure cap", strength: "deterministic", satisfies: [{ framework: "mas-safr", clause: "cumulative-exposure" }, { framework: "mas-safr", clause: "runtime-checkpoint" }] },
        { id: "c-fin-replay", kind: "policy", label: "Forensic replay ledger", strength: "deterministic", satisfies: [{ framework: "mas-safr", clause: "forensic-replay" }] },
      ],
      humanOversight: [{ id: "og-approve", stage: "pre-release", authorisedRole: "risk-officer@bank", mode: "blocking" }],
      lastDiscoveredAt: SWEPT,
    },
  ],
};

const azureAi: DiscoveryConnector = {
  source: "azure-ai-agents",
  label: "Azure AI Agent Service",
  channel: "control-plane",
  discover: () => [
    {
      id: "azure:claims-triage",
      name: "Claims Triage Copilot",
      source: "azure-ai-agents",
      externalRef: "/subscriptions/…/agents/claims-triage",
      discoveredVia: "control-plane",
      runtime: { platform: "Azure AI Foundry Agent Service", region: "westeurope" },
      owner: "Claims Ops",
      purpose: "Triage inbound insurance claims and flag suspected fraud",
      skills: ["policy-lookup", "fraud-scoring"],
      dataCategories: ["PII", "claims"],
      lifecycleStage: "deployed",
      materiality: { tierRationale: "Medium — advisory triage, no external dispatch" },
      thirdParty: { provider: "Microsoft Azure OpenAI" },
      tools: [
        { id: "policy-lookup", intent: "retrieve", scopes: ["search:read"], egress: false, leastPrivilegeVerified: true },
        { id: "fraud-score", intent: "compute", scopes: [], egress: false, leastPrivilegeVerified: true },
      ],
      models: ["azure-openai:gpt-4o"],
      dataSources: ["Azure AI Search: policies"],
      autonomy: { canDispatchExternally: false, scopes: ["search:read"] },
      enforcement: { mode: "inline", bindable: true, via: "Regent MCP gateway (or Azure Content Safety)" },
      nodes: [
        { id: "intake", name: "FNOL Intake", kind: "agent" },
        { id: "fraud", name: "Fraud Score", kind: "agent" },
      ],
      edges: [{ from: "intake", to: "fraud" }],
      riskSignals: { agency: 2, authority: 2, impact: 2, exposure: 1, recoverability: 1 },
      materialityTier: 3,
      accountability: { owner: "Claims Ops", accountableOfficer: "Head of Claims", validator: "Model Risk (2LoD)" },
      modelRefs: [{ id: "gpt-4o", role: "generative", provider: "OpenAI (Azure)", thirdParty: true, bindingRole: "none" }],
      dataSourceRefs: [{ id: "Azure AI Search: policies", class: "knowledge", sensitivity: "confidential", residency: "westeurope", recencySlaMonths: 12 }],
      controls: [
        { id: "c-verify", kind: "verifier", label: "Deterministic loss-amount verification", strength: "deterministic", satisfies: [{ framework: "mas-ai-rg", clause: "monitoring" }, { framework: "nist-ai-rmf", clause: "measure" }] },
        { id: "c-log", kind: "policy", label: "Replayable trace log", strength: "deterministic", satisfies: [{ framework: "eu-ai-act", clause: "art12" }] },
        { id: "c-fairness", kind: "guardrail", label: "Bias monitor", strength: "advisory", satisfies: [{ framework: "mas-feat", clause: "fairness" }] },
      ],
      lastDiscoveredAt: SWEPT,
    },
    {
      id: "azure:hr-copilot",
      name: "HR Policy Copilot",
      source: "azure-ai-agents",
      externalRef: "PowerPlatform:env/agents/hr-copilot",
      discoveredVia: "control-plane",
      runtime: { platform: "Microsoft Copilot Studio", tenant: "contoso" },
      owner: "People Ops",
      purpose: "Answer employee HR-policy questions",
      skills: ["policy-qa"],
      dataCategories: ["employee-data"],
      lifecycleStage: "deployed",
      materiality: { tierRationale: "Low — internal Q&A, no decisions or dispatch" },
      thirdParty: { provider: "Microsoft Copilot Studio" },
      tools: [{ id: "hr-kb", intent: "retrieve", scopes: ["dataverse:read"], egress: false, leastPrivilegeVerified: true }],
      models: ["azure-openai:gpt-4o-mini"],
      dataSources: ["Dataverse: hr-policies"],
      autonomy: { canDispatchExternally: false, scopes: ["dataverse:read"] },
      enforcement: { mode: "native", bindable: true, via: "Copilot Studio DLP" },
      nodes: [{ id: "answer", name: "Policy Answering", kind: "agent" }],
      edges: [],
      riskSignals: { agency: 1, authority: 1, impact: 1, exposure: 1, recoverability: 0 },
      materialityTier: 2,
      accountability: { owner: "People Ops", accountableOfficer: "Head of People Ops" },
      modelRefs: [{ id: "gpt-4o-mini", role: "generative", provider: "OpenAI (Azure)", thirdParty: true, bindingRole: "none" }],
      dataSourceRefs: [{ id: "Dataverse: hr-policies", class: "knowledge", sensitivity: "internal", recencySlaMonths: 12 }],
      controls: [
        { id: "c-log", kind: "policy", label: "Platform activity log", strength: "detective", satisfies: [{ framework: "iso-42001", clause: "records" }] },
        { id: "c-transparency", kind: "guardrail", label: "Disclosure to user", strength: "advisory", satisfies: [{ framework: "mas-feat", clause: "transparency" }] },
      ],
      lastDiscoveredAt: SWEPT,
    },
  ],
};

const salesforce: DiscoveryConnector = {
  source: "salesforce-agentforce",
  label: "Salesforce Agentforce",
  channel: "control-plane",
  discover: () => [
    {
      id: "sfdc:service-agent",
      name: "Service Agentforce Agent",
      source: "salesforce-agentforce",
      externalRef: "GenAiPlanner/Service_Agent",
      discoveredVia: "control-plane",
      runtime: { platform: "Salesforce Agentforce", tenant: "acme.my.salesforce.com" },
      owner: "Customer Service",
      purpose: "Resolve customer service cases, including issuing refunds",
      skills: ["case-understanding", "refund-issuance"],
      dataCategories: ["PII", "customer-360"],
      lifecycleStage: "deployed",
      materiality: { tierRationale: "High — issues refunds (external dispatch) affecting customers and funds" },
      thirdParty: { provider: "Salesforce", contract: "Agentforce SKU" },
      tools: [
        { id: "case-lookup", intent: "retrieve", scopes: ["case:read"], egress: false, leastPrivilegeVerified: true },
        { id: "issue-refund", intent: "dispatch", scopes: ["refund:write"], egress: true, leastPrivilegeVerified: false },
      ],
      models: ["einstein:atlas"],
      dataSources: ["Data Cloud: customer-360"],
      autonomy: { canDispatchExternally: true, scopes: ["case:read", "refund:write"] },
      enforcement: { mode: "native", bindable: true, via: "Einstein Trust Layer (+ observe)" },
      nodes: [
        { id: "understand", name: "Understand Case", kind: "agent" },
        { id: "refund", name: "Issue Refund", kind: "tool" },
      ],
      edges: [{ from: "understand", to: "refund" }],
      riskSignals: { agency: 3, authority: 2, impact: 2, exposure: 3, recoverability: 2 },
      materialityTier: 4,
      accountability: { owner: "Customer Service", accountableOfficer: "Head of Service" },
      modelRefs: [{ id: "einstein:atlas", role: "generative", provider: "Salesforce", thirdParty: true, bindingRole: "none" }],
      dataSourceRefs: [{ id: "Data Cloud: customer-360", class: "knowledge", sensitivity: "pii", recencySlaMonths: 6 }],
      controls: [
        // native-only: refund approval is NOT a deterministic Regent control → art14 stays a gap
        { id: "c-approval", kind: "human-oversight", label: "Refund approval (platform Trust Layer)", strength: "detective", satisfies: [{ framework: "eu-ai-act", clause: "art14" }, { framework: "sg-mgf", clause: "human-accountability" }] },
        { id: "c-log", kind: "policy", label: "Event Monitoring log", strength: "detective", satisfies: [{ framework: "eu-ai-act", clause: "art12" }] },
        { id: "c-fairness", kind: "guardrail", label: "Bias review", strength: "advisory", satisfies: [{ framework: "mas-feat", clause: "fairness" }] },
      ],
      humanOversight: [{ id: "og-refund", stage: "pre-dispatch", authorisedRole: "service-manager", mode: "advisory" }],
      lastDiscoveredAt: SWEPT,
    },
  ],
};

const sapJoule: DiscoveryConnector = {
  source: "sap-joule",
  label: "SAP Joule",
  channel: "control-plane",
  discover: () => [
    {
      id: "sap:procurement",
      name: "Procurement Joule Agent",
      source: "sap-joule",
      externalRef: "BTP:joule/procurement",
      discoveredVia: "control-plane",
      runtime: { platform: "SAP Joule / BTP AI Core", tenant: "sap-prd" },
      owner: "Procurement",
      purpose: "Assist procurement and create purchase orders",
      skills: ["po-lookup", "po-creation"],
      dataCategories: ["vendor-data", "financials"],
      lifecycleStage: "deployed",
      materiality: { tierRationale: "High — creates purchase orders (write authority) committing spend" },
      thirdParty: { provider: "SAP" },
      tools: [
        { id: "po-lookup", intent: "retrieve", scopes: ["po:read"], egress: false, leastPrivilegeVerified: true },
        { id: "create-po", intent: "write", scopes: ["po:write"], egress: true, leastPrivilegeVerified: false },
      ],
      models: ["sap:foundation-model"],
      dataSources: ["S/4HANA: purchase-orders"],
      autonomy: { canDispatchExternally: true, scopes: ["po:read", "po:write"] },
      enforcement: { mode: "observe", bindable: false, via: "trace ingest (no inline hook)" },
      nodes: [
        { id: "assess", name: "Assess Need", kind: "agent" },
        { id: "po", name: "Create PO", kind: "tool" },
      ],
      edges: [{ from: "assess", to: "po" }],
      riskSignals: { agency: 2, authority: 3, impact: 2, exposure: 2, recoverability: 2 },
      materialityTier: 3,
      accountability: { owner: "Procurement", accountableOfficer: "Head of Procurement" },
      modelRefs: [{ id: "sap:foundation-model", role: "generative", provider: "SAP", thirdParty: true, bindingRole: "none" }],
      dataSourceRefs: [{ id: "S/4HANA: purchase-orders", class: "dataset-reference", sensitivity: "confidential", recencySlaMonths: 1 }],
      controls: [
        // observe-only: only detective coverage → every mapped clause is a gap
        { id: "c-trace", kind: "policy", label: "PO trace ingest", strength: "detective", satisfies: [{ framework: "mas-ai-rg", clause: "monitoring" }, { framework: "eu-ai-act", clause: "art12" }] },
      ],
      lastDiscoveredAt: SWEPT,
    },
  ],
};

const codeScan: DiscoveryConnector = {
  source: "code-scan",
  label: "Code scan (LangGraph / CrewAI)",
  channel: "code",
  discover: () => [
    {
      id: "code:langgraph-support",
      name: "LangGraph Support Agent",
      source: "code-scan",
      externalRef: "repo:acme/support-bot · app/graph.py",
      discoveredVia: "code",
      runtime: { platform: "Self-hosted (LangGraph)", region: "on-prem" },
      owner: "Platform Eng",
      purpose: "Answer customer support questions and send replies",
      skills: ["kb-search", "reply"],
      dataCategories: ["PII"],
      lifecycleStage: "validation",
      materiality: { tierRationale: "Medium — sends external replies; in validation, not yet in production" },
      tools: [
        { id: "search", intent: "retrieve", scopes: ["kb:read"], egress: false, leastPrivilegeVerified: true },
        { id: "reply", intent: "dispatch", scopes: ["reply:send"], egress: true, leastPrivilegeVerified: true },
      ],
      models: ["anthropic.claude-3-5-sonnet"],
      dataSources: ["pgvector: kb"],
      autonomy: { canDispatchExternally: true, scopes: ["kb:read", "reply:send"] },
      enforcement: { mode: "inline", bindable: true, via: "Regent SDK middleware / MCP gateway" },
      nodes: [
        { id: "retrieve", name: "retrieve", kind: "agent" },
        { id: "respond", name: "respond", kind: "tool" },
      ],
      edges: [{ from: "retrieve", to: "respond" }],
      riskSignals: { agency: 2, authority: 2, impact: 1, exposure: 3, recoverability: 1 },
      materialityTier: 3,
      accountability: { owner: "Platform Eng", accountableOfficer: "Eng Lead", validator: "Model Risk (2LoD)" },
      modelRefs: [{ id: "anthropic.claude-3-5-sonnet", role: "generative", provider: "Anthropic", version: "20241022", thirdParty: true, bindingRole: "none" }],
      dataSourceRefs: [{ id: "pgvector: kb", class: "knowledge", sensitivity: "pii", recencySlaMonths: 6 }],
      controls: [
        { id: "c-approval", kind: "human-oversight", label: "Authenticated approval before reply", strength: "deterministic", satisfies: [{ framework: "eu-ai-act", clause: "art14" }] },
        { id: "c-log", kind: "policy", label: "Replayable trace log", strength: "deterministic", satisfies: [{ framework: "eu-ai-act", clause: "art12" }, { framework: "iso-42001", clause: "records" }] },
      ],
      humanOversight: [{ id: "og-reply", stage: "pre-reply", authorisedRole: "support-lead", mode: "blocking" }],
      lastDiscoveredAt: SWEPT,
    },
  ],
};

const otelEgress: DiscoveryConnector = {
  source: "otel-egress",
  label: "OTel egress (behavioral)",
  channel: "runtime",
  discover: () => [
    {
      id: "otel:unattributed-egress",
      name: "Unattributed agent → api.openai.com",
      source: "otel-egress",
      externalRef: "gen_ai.system=openai · svc=marketing-tools",
      discoveredVia: "runtime",
      runtime: { platform: "Unknown (egress observed)", region: "unknown" },
      owner: "Unassigned",
      purpose: "Unknown — shadow AI pending triage",
      skills: [],
      dataCategories: ["unknown"],
      lifecycleStage: "intake",
      materiality: { tierRationale: "Unassessed — shadow AI; materiality to be determined on triage" },
      thirdParty: { provider: "OpenAI (observed)" },
      tools: [{ id: "unknown", intent: "compute", scopes: [], egress: true, leastPrivilegeVerified: false }],
      models: ["openai:gpt-4o (observed)"],
      dataSources: [],
      autonomy: { canDispatchExternally: true, scopes: [] },
      enforcement: { mode: "observe", bindable: false, via: "egress proxy (candidate for inline)" },
      nodes: [{ id: "unknown", name: "Unattributed", kind: "agent" }],
      edges: [],
      riskSignals: { agency: 2, authority: 1, impact: 1, exposure: 3, recoverability: 1 },
      materialityTier: 3,
      modelRefs: [{ id: "gpt-4o", role: "generative", provider: "OpenAI (observed)", thirdParty: true, bindingRole: "none" }],
      dataSourceRefs: [],
      controls: [
        { id: "c-egress", kind: "policy", label: "Egress observation only", strength: "detective", satisfies: [{ framework: "mas-ai-rg", clause: "inventory" }] },
      ],
      lastDiscoveredAt: SWEPT,
    },
  ],
};

export const CONNECTORS: readonly DiscoveryConnector[] = [awsBedrock, azureAi, salesforce, sapJoule, codeScan, otelEgress];

/** Run every connector, normalise, and dedup by manifest id (last write wins). */
export function discoverAll(sources?: readonly string[]): AgentManifest[] {
  const active = sources && sources.length ? CONNECTORS.filter((c) => sources.includes(c.source)) : CONNECTORS;
  const byId = new Map<string, AgentManifest>();
  for (const c of active) for (const m of c.discover()) byId.set(m.id, m);
  return [...byId.values()];
}

/**
 * Model assets — the non-agentic half of the MAS AI RG inventory (foundation,
 * embedding, and classical-ML models discovered from model registries / usage).
 */
const MODELS: readonly ModelManifest[] = [
  {
    id: "model:credit-scorecard-v4",
    name: "Credit Scorecard v4 (XGBoost)",
    kind: "classical-ml",
    provider: "In-house",
    hostedOn: "AWS SageMaker",
    externalRef: "mlflow://models/credit-scorecard/4",
    owner: "Model Risk (2LoD)",
    purpose: "Probability-of-default scoring for retail credit",
    dataCategories: ["PII", "financials", "bureau"],
    lifecycleStage: "deployed",
    riskSignals: { agency: 1, authority: 2, impact: 3, exposure: 2, recoverability: 2 },
    usedByAgents: ["aws-bedrock:loan-underwriter"],
  },
  {
    id: "model:fraud-gbm",
    name: "Fraud Detection GBM",
    kind: "classical-ml",
    provider: "In-house",
    hostedOn: "Azure ML",
    externalRef: "azureml://models/fraud-gbm/7",
    owner: "Financial Crime",
    purpose: "Transaction fraud probability scoring",
    dataCategories: ["PII", "transactions"],
    lifecycleStage: "deployed",
    riskSignals: { agency: 1, authority: 2, impact: 2, exposure: 2, recoverability: 1 },
    usedByAgents: ["azure:claims-triage"],
  },
  {
    id: "model:claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    kind: "foundation",
    provider: "Anthropic",
    hostedOn: "AWS Bedrock",
    externalRef: "bedrock:anthropic.claude-3-5-sonnet",
    owner: "AI Platform",
    purpose: "Reasoning / generation foundation model",
    dataCategories: ["varies-by-use"],
    lifecycleStage: "deployed",
    thirdParty: { provider: "Anthropic (via AWS Bedrock)" },
    riskSignals: { agency: 2, authority: 1, impact: 2, exposure: 2, recoverability: 1 },
    usedByAgents: ["aws-bedrock:loan-underwriter", "code:langgraph-support"],
  },
  {
    id: "model:gpt-4o",
    name: "GPT-4o",
    kind: "foundation",
    provider: "OpenAI",
    hostedOn: "Azure OpenAI",
    externalRef: "azure-openai:gpt-4o",
    owner: "AI Platform",
    purpose: "Reasoning / generation foundation model",
    dataCategories: ["varies-by-use"],
    lifecycleStage: "deployed",
    thirdParty: { provider: "OpenAI (via Microsoft Azure)" },
    riskSignals: { agency: 2, authority: 1, impact: 2, exposure: 2, recoverability: 1 },
    usedByAgents: ["azure:claims-triage"],
  },
];

export function discoverModels(): ModelManifest[] {
  return [...MODELS];
}
