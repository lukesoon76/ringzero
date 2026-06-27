/**
 * P6 — Policy, compliance & attestation. Generates a per-use-case attestation
 * from REAL run evidence (a reconstructed governed run), mapping each fired
 * control to the exact trace event that evidences it, across EU AI Act, MAS, and
 * Singapore MGF. Unmet obligations are reported as GAPS — never asserted
 * satisfied. This is the second half of the "aha": enforcement and the audit
 * trail fall out of the same substrate.
 */

import type { ReconstructedRun } from "@ring-zero/telemetry";
import { CONTROL_CATALOG, FINDERS, SEVERITY_RANK, type ControlEvidence, type Severity } from "./frameworks.js";

export interface ControlMapping {
  readonly controlId: string;
  readonly standard: string;
  readonly title: string;
  readonly severity: Severity;
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
  /** Share of catalogue controls resolved to real trace evidence (0–100). */
  readonly coveragePct: number;
  readonly controls: readonly ControlMapping[];
  /** Unmet obligations, ranked by regulatory exposure (critical → medium). */
  readonly gaps: readonly string[];
}

export function generateAttestation(run: ReconstructedRun, useCase: string): Attestation {
  const controls: ControlMapping[] = CONTROL_CATALOG.map((spec) => {
    const evidence = FINDERS[spec.finder](run);
    const base = {
      controlId: spec.controlId,
      standard: spec.standard,
      title: spec.title,
      severity: spec.severity,
    };
    return evidence ? { ...base, satisfied: true, evidence } : { ...base, satisfied: false, gap: spec.gapMessage };
  });

  const satisfied = controls.filter((c) => c.satisfied).length;
  const coveragePct = controls.length === 0 ? 0 : Math.round((satisfied / controls.length) * 100);
  const gaps = controls
    .filter((c) => !c.satisfied)
    .slice()
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .map((c) => `[${c.severity.toUpperCase()}] ${c.standard}: ${c.gap}`);

  return {
    useCase,
    runId: run.runId,
    tier: run.tier,
    terminal: run.terminal,
    generatedFrom: "real run evidence",
    coveragePct,
    controls,
    gaps,
  };
}
