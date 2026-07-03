/**
 * Discovery connectors — one per platform. Each maps its platform's native shape
 * onto the canonical AgentManifest (agents) and ModelManifest (models), carrying
 * the MAS AI RG inventory metadata (purpose, skills, data categories, lifecycle,
 * materiality rationale, third-party). In production `discover()` calls the
 * platform's management API / telemetry; here they return representative fixtures.
 */

import type { AgentManifest, DiscoveryConnector, ModelManifest } from "./manifest.js";

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
        { id: "kb-retrieve", intent: "retrieve" },
        { id: "score-lambda", intent: "compute" },
        { id: "decision-api", intent: "dispatch" },
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
        { id: "policy-lookup", intent: "retrieve" },
        { id: "fraud-score", intent: "compute" },
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
      tools: [{ id: "hr-kb", intent: "retrieve" }],
      models: ["azure-openai:gpt-4o-mini"],
      dataSources: ["Dataverse: hr-policies"],
      autonomy: { canDispatchExternally: false, scopes: ["dataverse:read"] },
      enforcement: { mode: "native", bindable: true, via: "Copilot Studio DLP" },
      nodes: [{ id: "answer", name: "Policy Answering", kind: "agent" }],
      edges: [],
      riskSignals: { agency: 1, authority: 1, impact: 1, exposure: 1, recoverability: 0 },
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
        { id: "case-lookup", intent: "retrieve" },
        { id: "issue-refund", intent: "dispatch" },
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
        { id: "po-lookup", intent: "retrieve" },
        { id: "create-po", intent: "write" },
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
        { id: "search", intent: "retrieve" },
        { id: "reply", intent: "dispatch" },
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
      tools: [{ id: "unknown", intent: "compute" }],
      models: ["openai:gpt-4o (observed)"],
      dataSources: [],
      autonomy: { canDispatchExternally: true, scopes: [] },
      enforcement: { mode: "observe", bindable: false, via: "egress proxy (candidate for inline)" },
      nodes: [{ id: "unknown", name: "Unattributed", kind: "agent" }],
      edges: [],
      riskSignals: { agency: 2, authority: 1, impact: 1, exposure: 3, recoverability: 1 },
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
