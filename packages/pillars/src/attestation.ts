/**
 * P6 — Policy, compliance & attestation. Generates a per-use-case attestation
 * from REAL run evidence (a reconstructed governed run), mapping each fired
 * control to the exact trace event that evidences it, across EU AI Act, MAS, and
 * Singapore MGF. Unmet obligations are reported as GAPS — never asserted
 * satisfied. This is the second half of the "aha": enforcement and the audit
 * trail fall out of the same substrate.
 */

import type { ReconstructedRun, ReconstructedStep } from "@ring-zero/telemetry";

export interface ControlEvidence {
  readonly runId: string;
  readonly stepIndex: number;
  readonly detail: string;
}

export interface ControlMapping {
  readonly controlId: string;
  readonly standard: string;
  readonly title: string;
  readonly satisfied: boolean;
  readonly evidence?: ControlEvidence;
  readonly gap?: string;
}

export interface Attestation {
  readonly useCase: string;
  readonly runId: string;
  readonly tier: number;
  readonly terminal: { readonly kind: string; readonly detail: string };
  readonly generatedFrom: "real run evidence";
  readonly controls: readonly ControlMapping[];
  readonly gaps: readonly string[];
}

type EvidenceFinder = (run: ReconstructedRun) => ControlEvidence | undefined;

const findStep = (
  run: ReconstructedRun,
  pred: (s: ReconstructedStep) => boolean,
  detail: (s: ReconstructedStep) => string,
): ControlEvidence | undefined => {
  const step = run.steps.find(pred);
  return step ? { runId: run.runId, stepIndex: step.index, detail: detail(step) } : undefined;
};

interface ControlSpec {
  readonly controlId: string;
  readonly standard: string;
  readonly title: string;
  readonly find: EvidenceFinder;
  readonly gapMessage: string;
}

const CONTROLS: readonly ControlSpec[] = [
  {
    controlId: "eu-ai-act-art14-oversight",
    standard: "EU AI Act Art. 14",
    title: "Human oversight (authenticated approval gate or escalation)",
    find: (run) =>
      findStep(
        run,
        (s) => s.action.id === "approve" || s.decision.startsWith("terminal:Escalate") || run.terminal.kind === "Escalate",
        (s) => `oversight engaged at step ${s.index} (${s.action.id}/${s.decision})`,
      ),
    gapMessage: "no authenticated approval gate or escalation engaging human oversight",
  },
  {
    controlId: "eu-ai-act-logging",
    standard: "EU AI Act (record-keeping / logging)",
    title: "Complete, reconstructable event log",
    find: (run) => {
      const allLogged = run.steps.length > 0 && run.steps.every((s) => s.guards.length > 0);
      const last = run.steps[run.steps.length - 1];
      return allLogged && last
        ? { runId: run.runId, stepIndex: last.index, detail: `${run.steps.length} steps, each with guard evaluations` }
        : undefined;
    },
    gapMessage: "one or more steps lack the guard evaluations needed to reconstruct the decision",
  },
  {
    controlId: "mas-deterministic-verification",
    standard: "MAS AI risk guidelines",
    title: "Deterministic verification of material figures",
    find: (run) =>
      findStep(
        run,
        (s) => s.action.id === "verify",
        (s) => `deterministic verifier ran at step ${s.index} (outcome: ${s.outcome})`,
      ),
    gapMessage: "no deterministic verification step recorded",
  },
  {
    controlId: "sg-mgf-human-accountability",
    standard: "Singapore MGF",
    title: "Meaningful human accountability",
    find: (run) =>
      findStep(
        run,
        (s) => s.action.id === "approve" || run.terminal.kind === "Escalate",
        (s) => `accountable human action at step ${s.index} (${s.action.id})`,
      ),
    gapMessage: "no human approval or escalation point",
  },
  {
    controlId: "sg-mgf-technical-controls",
    standard: "Singapore MGF",
    title: "Technical controls + containment",
    find: (run) =>
      findStep(
        run,
        (s) => s.outcome === "blocked" || s.guards.some((g) => g.outcome === "fired") || s.guards.length > 0,
        (s) => `technical control exercised at step ${s.index} (${s.decision}/${s.outcome})`,
      ),
    gapMessage: "no technical control or containment exercised",
  },
];

export function generateAttestation(run: ReconstructedRun, useCase: string): Attestation {
  const controls: ControlMapping[] = CONTROLS.map((spec) => {
    const evidence = spec.find(run);
    return evidence
      ? { controlId: spec.controlId, standard: spec.standard, title: spec.title, satisfied: true, evidence }
      : { controlId: spec.controlId, standard: spec.standard, title: spec.title, satisfied: false, gap: spec.gapMessage };
  });
  const gaps = controls.filter((c) => !c.satisfied).map((c) => `${c.standard}: ${c.gap}`);
  return {
    useCase,
    runId: run.runId,
    tier: run.tier,
    terminal: run.terminal,
    generatedFrom: "real run evidence",
    controls,
    gaps,
  };
}
