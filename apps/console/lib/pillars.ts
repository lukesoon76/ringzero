export type Stance = "REAL" | "THIN" | "MOCK";

export interface Pillar {
  id: string;
  name: string;
  stance: Stance;
  owns: string;
  fn: string;
  incumbents: string;
}

/** The 8-pillar map (Part A) as a product surface — what Regent owns vs integrates. */
export const PILLARS: Pillar[] = [
  {
    id: "P1",
    name: "Discovery & Inventory",
    stance: "THIN",
    owns: "Integrate",
    fn: "Registry + per-agent agent card",
    incumbents: "Zenity, Credo AI, Dataiku Govern",
  },
  {
    id: "P2",
    name: "Risk Assessment & Tiering",
    stance: "THIN",
    owns: "Integrate",
    fn: "5-dimension scorer → Tier 1–4 → enforcement intensity",
    incumbents: "Credo, Modulos, IBM",
  },
  {
    id: "P3",
    name: "Testing, Evaluation & Assurance",
    stance: "REAL",
    owns: "Own (narrow)",
    fn: "The five named attacks, each demonstrably blocked",
    incumbents: "Resaro, AI Verify, Lakera, HiddenLayer",
  },
  {
    id: "P4",
    name: "Runtime Execution Governance",
    stance: "REAL",
    owns: "OWN (deep) ★",
    fn: "Deterministic, fail-closed enforcement over the trajectory",
    incumbents: "WHITE SPACE — no deterministic MRM-grade kernel",
  },
  {
    id: "P5",
    name: "Observability & Monitoring",
    stance: "THIN",
    owns: "Own substrate",
    fn: "Governance-semantic OTel traces + full replay",
    incumbents: "Fiddler, Arthur, Dataiku",
  },
  {
    id: "P6",
    name: "Policy, Compliance & Attestation",
    stance: "THIN",
    owns: "Integrate",
    fn: "Attestation from the same run evidence",
    incumbents: "Credo, IBM watsonx.governance, Modulos",
  },
  {
    id: "P7",
    name: "Identity, Authority & Security",
    stance: "THIN",
    owns: "Integrate",
    fn: "Identity + default-deny least privilege in the gateway",
    incumbents: "Zenity, AGNTCY-style identity",
  },
  {
    id: "P8",
    name: "Human Oversight & Accountability",
    stance: "THIN",
    owns: "Integrate",
    fn: "Authenticated approval events; event-driven HITL",
    incumbents: "Credo workflow, Dataiku approvals",
  },
];

export const STANDARDS = [
  "EU AI Act (Art. 14, logging)",
  "MAS AI risk guidelines",
  "Singapore MGF",
  "NIST AI RMF",
  "ISO/IEC 42001",
  "SR 11-7 / PRA SS1/23 / OSFI E-23",
  "OWASP LLM Top 10 + Agentic",
  "MITRE ATLAS",
];
