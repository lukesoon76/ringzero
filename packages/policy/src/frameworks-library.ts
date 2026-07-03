/**
 * A browsable library of known AI-governance frameworks. This is REFERENCE DATA
 * — frameworks are data, not code (adding one is an authoring task). The console
 * Frameworks page lets a user browse, choose, and download a framework pack as a
 * portable JSON artifact. Requirement text is summarised for orientation, not a
 * substitute for the source instrument.
 */

export type RequirementSeverity = "critical" | "high" | "medium";

export interface FrameworkRequirement {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly severity: RequirementSeverity;
}

export interface FrameworkPack {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly jurisdiction: string;
  readonly authority: string;
  readonly status: "In force" | "Phased" | "Proposed" | "Guidance";
  readonly effective: string;
  readonly summary: string;
  readonly tags: readonly string[];
  readonly requirements: readonly FrameworkRequirement[];
}

export const FRAMEWORK_LIBRARY: readonly FrameworkPack[] = [
  {
    id: "eu-ai-act",
    name: "EU Artificial Intelligence Act",
    shortName: "EU AI Act",
    jurisdiction: "European Union",
    authority: "European Commission / AI Office",
    status: "Phased",
    effective: "2024–2027 (phased)",
    summary:
      "Risk-tiered regulation of AI systems. High-risk systems carry obligations spanning risk management, data governance, logging, human oversight, transparency, and robustness.",
    tags: ["high-risk", "horizontal", "conformity"],
    requirements: [
      { id: "art9", title: "Risk management system", text: "Establish, document, and maintain a continuous risk management system across the AI lifecycle.", severity: "critical" },
      { id: "art10", title: "Data & data governance", text: "Training, validation, and testing data sets meet quality criteria and are governed for relevance and bias.", severity: "high" },
      { id: "art12", title: "Record-keeping / logging", text: "Automatic logging of events over the system's lifetime sufficient to ensure traceability.", severity: "high" },
      { id: "art14", title: "Human oversight", text: "Design for effective oversight by natural persons, including the ability to intervene or halt operation.", severity: "critical" },
      { id: "art15", title: "Accuracy, robustness & cybersecurity", text: "Appropriate levels of accuracy, robustness, and resilience against errors and adversarial manipulation.", severity: "high" },
    ],
  },
  {
    id: "nist-ai-rmf",
    name: "NIST AI Risk Management Framework 1.0",
    shortName: "NIST AI RMF",
    jurisdiction: "United States",
    authority: "NIST",
    status: "Guidance",
    effective: "2023",
    summary:
      "Voluntary framework structured around four functions — Govern, Map, Measure, Manage — to improve the trustworthiness of AI systems.",
    tags: ["voluntary", "trustworthiness", "lifecycle"],
    requirements: [
      { id: "govern", title: "Govern", text: "Cultivate a culture of risk management; policies, accountability, and oversight structures.", severity: "high" },
      { id: "map", title: "Map", text: "Establish context and identify risks across the AI system and its use.", severity: "medium" },
      { id: "measure", title: "Measure", text: "Analyse, assess, and track AI risks with quantitative and qualitative methods.", severity: "high" },
      { id: "manage", title: "Manage", text: "Prioritise and act on risks; allocate resources to treat, monitor, and respond.", severity: "high" },
    ],
  },
  {
    id: "iso-42001",
    name: "ISO/IEC 42001:2023 — AI Management System",
    shortName: "ISO/IEC 42001",
    jurisdiction: "International",
    authority: "ISO / IEC",
    status: "In force",
    effective: "2023",
    summary:
      "Certifiable management-system standard for AI: requirements to establish, implement, maintain, and continually improve an AI management system (AIMS).",
    tags: ["certifiable", "AIMS", "controls"],
    requirements: [
      { id: "aims", title: "AI management system", text: "Establish an AIMS with policy, objectives, roles, and continual improvement.", severity: "high" },
      { id: "impact", title: "AI impact assessment", text: "Assess impacts of AI systems on individuals and society throughout the lifecycle.", severity: "high" },
      { id: "annexa", title: "Operational controls (Annex A)", text: "Implement applicable controls for data, lifecycle, transparency, and accountability.", severity: "medium" },
      { id: "records", title: "Documented information", text: "Maintain records sufficient to demonstrate conformity and reconstruct decisions.", severity: "medium" },
    ],
  },
  {
    id: "mas-feat",
    name: "MAS FEAT Principles",
    shortName: "MAS FEAT",
    jurisdiction: "Singapore",
    authority: "Monetary Authority of Singapore",
    status: "Guidance",
    effective: "2018 (Veritas toolkit 2022)",
    summary:
      "Principles to promote Fairness, Ethics, Accountability, and Transparency in the use of AI and data analytics in financial services.",
    tags: ["financial-services", "FEAT", "fairness"],
    requirements: [
      { id: "fairness", title: "Fairness", text: "Decisions are justifiable and systematically reviewed for unintended bias.", severity: "critical" },
      { id: "ethics", title: "Ethics", text: "AI use is aligned with the firm's ethical standards and codes of conduct.", severity: "medium" },
      { id: "accountability", title: "Accountability", text: "Internal and external accountability for AI-driven decisions is clearly assigned.", severity: "high" },
      { id: "transparency", title: "Transparency", text: "Appropriate disclosure to data subjects about AI use and its impact on them.", severity: "high" },
    ],
  },
  {
    id: "mas-ai-rg",
    name: "MAS Guidelines on AI Risk Management",
    shortName: "MAS AI RG",
    jurisdiction: "Singapore",
    authority: "Monetary Authority of Singapore",
    status: "Proposed",
    effective: "2024 (consultation)",
    summary:
      "Supervisory guidelines for financial institutions on managing AI risk across identification, oversight, development, deployment, and third-party use — anchored on a current, materiality-tiered AI inventory.",
    tags: ["financial-services", "inventory", "materiality", "third-party"],
    requirements: [
      { id: "inventory", title: "AI identification & inventory", text: "Maintain a current inventory of AI assets (agents, workflows, models, tools) at appropriate granularity, including shadow AI.", severity: "critical" },
      { id: "materiality", title: "Materiality assessment", text: "Assess and record the materiality of each AI use case to calibrate risk management and oversight.", severity: "critical" },
      { id: "oversight", title: "Governance & oversight", text: "Clear board/senior-management accountability and effective human oversight of AI.", severity: "high" },
      { id: "development", title: "Development & validation", text: "Sound data management, model development, and independent validation across the lifecycle.", severity: "high" },
      { id: "monitoring", title: "Deployment & monitoring", text: "Monitor deployed AI for performance, drift, and control effectiveness; contain on failure.", severity: "high" },
      { id: "third-party", title: "Third-party AI", text: "Govern procured / third-party and foundation-model AI with commensurate due diligence.", severity: "high" },
    ],
  },
  {
    id: "sg-mgf",
    name: "Singapore Model AI Governance Framework",
    shortName: "Singapore MGF",
    jurisdiction: "Singapore",
    authority: "IMDA / PDPC",
    status: "Guidance",
    effective: "2020 (Gen-AI MGF 2024)",
    summary:
      "Practical guidance translating ethical principles into implementable measures: internal governance, human oversight, operations management, and stakeholder communication.",
    tags: ["practical", "human-oversight", "containment"],
    requirements: [
      { id: "identity", title: "Unique identity", text: "Each agent has a unique, attributable identity for accountability.", severity: "high" },
      { id: "bound-risk", title: "Bound risk", text: "Authority and impact are bounded to the assessed risk of the use case.", severity: "critical" },
      { id: "human-accountability", title: "Human accountability", text: "Meaningful human accountability and the ability to intervene are preserved.", severity: "critical" },
      { id: "containment", title: "Technical controls + containment", text: "Technical controls exist to contain or halt the system on failure.", severity: "critical" },
    ],
  },
  {
    id: "colorado-sb21-169",
    name: "Colorado SB21-169 — Insurance Anti-Discrimination",
    shortName: "Colorado SB21-169",
    jurisdiction: "United States (Colorado)",
    authority: "Colorado Division of Insurance",
    status: "In force",
    effective: "2023+ (by line of business)",
    summary:
      "Restricts insurers' use of external consumer data and predictive models that result in unfair discrimination; requires governance, testing, and documentation.",
    tags: ["insurance", "anti-discrimination", "models"],
    requirements: [
      { id: "governance", title: "Governance & risk management", text: "Maintain a risk-management framework governing external data and predictive models.", severity: "high" },
      { id: "testing", title: "Testing for unfair discrimination", text: "Quantitatively test models for disproportionate negative outcomes by protected class.", severity: "critical" },
      { id: "documentation", title: "Documentation", text: "Document data sources, model design, and testing methodology and results.", severity: "high" },
      { id: "remediation", title: "Remediation", text: "Establish processes to remediate models found to produce unfair discrimination.", severity: "high" },
    ],
  },
  {
    id: "nyc-ll144",
    name: "NYC Local Law 144 — Automated Employment Decision Tools",
    shortName: "NYC LL144",
    jurisdiction: "United States (New York City)",
    authority: "NYC DCWP",
    status: "In force",
    effective: "2023",
    summary:
      "Requires a bias audit of automated employment decision tools, publication of results, and candidate notice prior to use.",
    tags: ["employment", "bias-audit", "notice"],
    requirements: [
      { id: "bias-audit", title: "Independent bias audit", text: "Annual independent bias audit of the automated employment decision tool.", severity: "critical" },
      { id: "publication", title: "Publish results", text: "Publicly publish a summary of the most recent bias audit results.", severity: "high" },
      { id: "notice", title: "Candidate notice", text: "Notify candidates that an automated tool will be used at least 10 business days in advance.", severity: "medium" },
    ],
  },
];

/** A portable, downloadable pack: the framework plus a provenance stamp. */
export function exportFrameworkPack(id: string): (FrameworkPack & { readonly schema: string; readonly source: string }) | null {
  const f = FRAMEWORK_LIBRARY.find((x) => x.id === id);
  if (!f) return null;
  return { schema: "ring-zero/framework-pack/v1", source: "Regent Governance Studio", ...f };
}
