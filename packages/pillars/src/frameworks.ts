/**
 * P6 — Compliance control catalogue, as DATA.
 *
 * The mapping of regulatory obligations → the trace evidence that satisfies them
 * lives here as a data table (CONTROL_CATALOG), so adding a framework (NIST AI
 * RMF, ISO/IEC 42001, …) is an authoring task, not a code change. Evidence
 * *finders* stay vetted code in a closed registry (FINDERS) keyed by name — a
 * catalogue entry can only reference a finder, never inject logic onto the
 * evidence path. One finder may evidence several standards (the same governed
 * step satisfying multiple frameworks), which is how real control mappings work.
 */

import type { ReconstructedRun, ReconstructedStep } from "@ring-zero/telemetry";

export interface ControlEvidence {
  readonly runId: string;
  readonly stepIndex: number;
  readonly detail: string;
}

export type EvidenceFinder = (run: ReconstructedRun) => ControlEvidence | undefined;

/** Regulatory exposure of an unmet control — drives gap ranking. */
export type Severity = "critical" | "high" | "medium";

/** Lower rank = surfaced first in the gap report. */
export const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2 };

const findStep = (
  run: ReconstructedRun,
  pred: (s: ReconstructedStep) => boolean,
  detail: (s: ReconstructedStep) => string,
): ControlEvidence | undefined => {
  const step = run.steps.find(pred);
  return step ? { runId: run.runId, stepIndex: step.index, detail: detail(step) } : undefined;
};

/**
 * Closed registry of vetted evidence finders. Catalogue entries reference these
 * by key; untrusted catalogue data can never introduce a new finder.
 */
export const FINDERS = {
  oversight: (run) =>
    findStep(
      run,
      (s) =>
        s.action.id === "approve" ||
        s.decision.startsWith("terminal:Escalate") ||
        run.terminal.kind === "Escalate",
      (s) => `oversight engaged at step ${s.index} (${s.action.id}/${s.decision})`,
    ),
  completeLog: (run) => {
    const allLogged = run.steps.length > 0 && run.steps.every((s) => s.guards.length > 0);
    const last = run.steps[run.steps.length - 1];
    return allLogged && last
      ? { runId: run.runId, stepIndex: last.index, detail: `${run.steps.length} steps, each with guard evaluations` }
      : undefined;
  },
  deterministicVerify: (run) =>
    findStep(
      run,
      (s) => s.action.id === "verify",
      (s) => `deterministic verifier ran at step ${s.index} (outcome: ${s.outcome})`,
    ),
  humanAccountability: (run) =>
    findStep(
      run,
      (s) => s.action.id === "approve" || run.terminal.kind === "Escalate",
      (s) => `accountable human action at step ${s.index} (${s.action.id})`,
    ),
  technicalControls: (run) =>
    findStep(
      run,
      (s) => s.outcome === "blocked" || s.guards.some((g) => g.outcome === "fired") || s.guards.length > 0,
      (s) => `technical control exercised at step ${s.index} (${s.decision}/${s.outcome})`,
    ),
} satisfies Record<string, EvidenceFinder>;

export type EvidenceFinderKey = keyof typeof FINDERS;

export interface ControlCatalogEntry {
  readonly controlId: string;
  readonly standard: string;
  readonly title: string;
  readonly severity: Severity;
  /** References a vetted finder in FINDERS — data cannot inject logic. */
  readonly finder: EvidenceFinderKey;
  readonly gapMessage: string;
}

/**
 * The control catalogue. Adding a framework is a row here, not a code change.
 * Reusing a `finder` across rows is deliberate: one governed step can evidence
 * obligations under several standards at once.
 */
export const CONTROL_CATALOG: readonly ControlCatalogEntry[] = [
  {
    controlId: "eu-ai-act-art14-oversight",
    standard: "EU AI Act Art. 14",
    title: "Human oversight (authenticated approval gate or escalation)",
    severity: "critical",
    finder: "oversight",
    gapMessage: "no authenticated approval gate or escalation engaging human oversight",
  },
  {
    controlId: "eu-ai-act-logging",
    standard: "EU AI Act (record-keeping / logging)",
    title: "Complete, reconstructable event log",
    severity: "high",
    finder: "completeLog",
    gapMessage: "one or more steps lack the guard evaluations needed to reconstruct the decision",
  },
  {
    controlId: "mas-deterministic-verification",
    standard: "MAS AI risk guidelines",
    title: "Deterministic verification of material figures",
    severity: "critical",
    finder: "deterministicVerify",
    gapMessage: "no deterministic verification step recorded",
  },
  {
    controlId: "sg-mgf-human-accountability",
    standard: "Singapore MGF",
    title: "Meaningful human accountability",
    severity: "high",
    finder: "humanAccountability",
    gapMessage: "no human approval or escalation point",
  },
  {
    controlId: "sg-mgf-technical-controls",
    standard: "Singapore MGF",
    title: "Technical controls + containment",
    severity: "critical",
    finder: "technicalControls",
    gapMessage: "no technical control or containment exercised",
  },
  {
    controlId: "nist-ai-rmf-measure",
    standard: "NIST AI RMF (MEASURE 2.x)",
    title: "Deterministic measurement of material outputs before action",
    severity: "high",
    finder: "deterministicVerify",
    gapMessage: "no deterministic measurement of material figures prior to release",
  },
  {
    controlId: "iso-42001-operational-records",
    standard: "ISO/IEC 42001 (A.8 operational records)",
    title: "Operational control records sufficient to reconstruct the decision",
    severity: "medium",
    finder: "completeLog",
    gapMessage: "operational records insufficient to reconstruct each decision",
  },
];
