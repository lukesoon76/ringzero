/**
 * P6 — Inventory attestation over the WHOLE estate (agents + models), and the
 * declared × exercised fusion.
 *
 * Two evidence axes, one taxonomy:
 *   - DECLARED  (attestInventory): which controls are BOUND across every asset —
 *     finders run over a NormalisedAsset (declared facts). Mirrors the
 *     frameworks-catalogue pattern: controls are DATA rows; finders are a CLOSED
 *     registry keyed by name, so catalogue data can never inject logic.
 *   - EXERCISED (exercisedFor*): which controls actually FIRED — for agents we
 *     compile the manifest to a workflow and run it under the kernel; for models
 *     the independent validation state is the evidence.
 *
 * combineInventory() fuses them: declared ∧ exercised = "binding" (strongest P6
 * evidence), declared ∧ ¬exercised = "unverified", ¬declared ∧ exercised =
 * "shadow", neither = "gap". Deterministic; a cell is "covered" ONLY when a
 * DETERMINISTIC declared control satisfies it — advisory/detective is surfaced,
 * never counted as a pass.
 */

import { runWorkflowSpec } from "@ring-zero/policy";
import { compileManifestToWorkflow } from "./compile-manifest.js";
import type { AgentManifest, ModelManifest } from "./manifest.js";

export type Severity = "critical" | "high" | "medium";
const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2 };
type ControlStrength = "deterministic" | "advisory" | "detective";

export interface NormalisedAsset {
  readonly id: string;
  readonly name: string;
  readonly class: "agent" | "model";
  readonly controls: ReadonlyArray<{ readonly kind: string; readonly strength: ControlStrength }>;
  readonly hasBlockingOversight: boolean;
  readonly accountableNamed: boolean;
  readonly bindable: boolean;
  readonly validationCurrent?: boolean;
  readonly driftMonitored?: boolean;
}

export type CoverageStatus = "covered" | "advisory" | "gap" | "na";
type InventoryFinder = (a: NormalisedAsset) => { status: CoverageStatus; detail: string };

const has = (a: NormalisedAsset, kind: string, strength: ControlStrength = "deterministic") => a.controls.some((c) => c.kind === kind && c.strength === strength);
const hasAnyDeterministic = (a: NormalisedAsset) => a.controls.some((c) => c.strength === "deterministic");
const advisoryOnly = (a: NormalisedAsset, kind: string) => !has(a, kind, "deterministic") && a.controls.some((c) => c.kind === kind && c.strength !== "deterministic");

/** Closed registry of declared-control finders (catalogue rows reference these by name). */
const INVENTORY_FINDERS = {
  oversightDeclared: (a) =>
    a.hasBlockingOversight
      ? { status: "covered", detail: "blocking authenticated human-oversight gate declared" }
      : a.accountableNamed
        ? { status: "advisory", detail: "accountable officer named but no blocking gate" }
        : { status: "gap", detail: "no human-oversight gate or named accountable officer" },
  loggingCapable: (a) =>
    a.bindable
      ? { status: "covered", detail: "inline/native enforcement — reconstructable event log" }
      : { status: "gap", detail: "observe-only enforcement — no binding event log" },
  deterministicVerifier: (a) =>
    has(a, "verifier", "deterministic")
      ? { status: "covered", detail: "deterministic verifier declared" }
      : advisoryOnly(a, "verifier")
        ? { status: "advisory", detail: "only an advisory (LLM-judge) verifier declared" }
        : { status: "gap", detail: "no deterministic verifier bound" },
  technicalControls: (a) =>
    has(a, "containment", "deterministic") || hasAnyDeterministic(a)
      ? { status: "covered", detail: "deterministic technical control / containment declared" }
      : { status: "gap", detail: "no deterministic technical control declared" },
  modelValidationCurrent: (a) =>
    a.class !== "model"
      ? { status: "na", detail: "n/a — not a model" }
      : a.validationCurrent
        ? { status: "covered", detail: "independent validation current" }
        : { status: "gap", detail: "validation overdue or absent" },
  modelMonitoring: (a) =>
    a.class !== "model"
      ? { status: "na", detail: "n/a — not a model" }
      : a.driftMonitored
        ? { status: "covered", detail: "drift monitoring in place" }
        : { status: "advisory", detail: "drift not monitored (e.g. vendor-managed weights)" },
} satisfies Record<string, InventoryFinder>;

type InventoryFinderKey = keyof typeof INVENTORY_FINDERS;

export interface CatalogRow {
  readonly controlId: string;
  readonly standard: string;
  readonly title: string;
  readonly severity: Severity;
  readonly finder: InventoryFinderKey;
  readonly appliesTo: "agent" | "model" | "both";
}

export const CONTROL_CATALOG: readonly CatalogRow[] = [
  { controlId: "eu-ai-act-art14-oversight", standard: "EU AI Act Art. 14", title: "Human oversight gate", severity: "critical", finder: "oversightDeclared", appliesTo: "agent" },
  { controlId: "eu-ai-act-logging", standard: "EU AI Act (logging)", title: "Reconstructable event log", severity: "high", finder: "loggingCapable", appliesTo: "agent" },
  { controlId: "mas-deterministic-verification", standard: "MAS AI risk guidelines", title: "Deterministic verification of material figures", severity: "critical", finder: "deterministicVerifier", appliesTo: "agent" },
  { controlId: "sg-mgf-human-accountability", standard: "Singapore MGF", title: "Meaningful human accountability", severity: "high", finder: "oversightDeclared", appliesTo: "agent" },
  { controlId: "sg-mgf-technical-controls", standard: "Singapore MGF", title: "Technical controls + containment", severity: "critical", finder: "technicalControls", appliesTo: "agent" },
  { controlId: "nist-ai-rmf-measure", standard: "NIST AI RMF (MEASURE)", title: "Deterministic measurement before action", severity: "high", finder: "deterministicVerifier", appliesTo: "agent" },
  { controlId: "sr-11-7-independent-validation", standard: "SR 11-7 / MAS AIMRM", title: "Independent, current model validation", severity: "critical", finder: "modelValidationCurrent", appliesTo: "model" },
  { controlId: "mas-aimrm-ongoing-monitoring", standard: "MAS AIMRM", title: "Ongoing model monitoring / drift", severity: "high", finder: "modelMonitoring", appliesTo: "model" },
];

export interface CoverageCell {
  readonly asset: string;
  readonly assetName: string;
  readonly assetClass: "agent" | "model";
  readonly controlId: string;
  readonly standard: string;
  readonly title: string;
  readonly status: CoverageStatus;
  readonly severity: Severity;
  readonly detail: string;
}
export interface StandardRollup {
  readonly standard: string;
  readonly applicable: number;
  readonly covered: number;
  readonly coveragePct: number;
}
export interface InventoryAttestation {
  readonly matrix: readonly CoverageCell[];
  readonly byStandard: readonly StandardRollup[];
  readonly gaps: readonly CoverageCell[];
  readonly coveragePct: number;
  readonly assetCount: number;
}

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));
const rankStatus = (s: CoverageStatus) => (s === "gap" ? 0 : s === "advisory" ? 1 : 2);

/** Walk every asset against every applicable catalogue row → one coverage matrix. */
export function attestInventory(assets: readonly NormalisedAsset[]): InventoryAttestation {
  const matrix: CoverageCell[] = [];
  for (const a of assets) {
    for (const row of CONTROL_CATALOG) {
      if (row.appliesTo !== "both" && row.appliesTo !== a.class) continue;
      const r = INVENTORY_FINDERS[row.finder](a);
      if (r.status === "na") continue;
      matrix.push({ asset: a.id, assetName: a.name, assetClass: a.class, controlId: row.controlId, standard: row.standard, title: row.title, status: r.status, severity: row.severity, detail: r.detail });
    }
  }
  const covered = matrix.filter((c) => c.status === "covered").length;
  const standards = [...new Set(matrix.map((c) => c.standard))];
  const byStandard: StandardRollup[] = standards.map((standard) => {
    const cells = matrix.filter((c) => c.standard === standard);
    const cov = cells.filter((c) => c.status === "covered").length;
    return { standard, applicable: cells.length, covered: cov, coveragePct: pct(cov, cells.length) };
  });
  const gaps = matrix
    .filter((c) => c.status === "gap" || c.status === "advisory")
    .sort((x, y) => rankStatus(x.status) - rankStatus(y.status) || SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity] || x.asset.localeCompare(y.asset));
  return { matrix, byStandard, gaps, coveragePct: pct(covered, matrix.length), assetCount: assets.length };
}

/* ---- normalisers ---- */
export function normaliseAgent(m: AgentManifest): NormalisedAsset {
  return {
    id: m.id,
    name: m.name,
    class: "agent",
    controls: (m.controls ?? []).map((c) => ({ kind: c.kind, strength: c.strength })),
    hasBlockingOversight: (m.humanOversight ?? []).some((g) => g.mode === "blocking"),
    accountableNamed: Boolean(m.accountability?.accountableOfficer),
    bindable: Boolean(m.enforcement?.bindable),
  };
}
export function normaliseModel(m: ModelManifest): NormalisedAsset {
  const status = m.validation?.status;
  const drift = m.recency?.driftStatus;
  return {
    id: m.id,
    name: m.name,
    class: "model",
    controls: status === "validated" ? [{ kind: "verifier", strength: "deterministic" }] : [],
    hasBlockingOversight: false,
    accountableNamed: Boolean(m.accountability?.accountableOfficer ?? m.owner),
    bindable: false,
    validationCurrent: status === "validated" || status === "exempt",
    driftMonitored: drift === "stable" || drift === "watch" || drift === "breach",
  };
}

/* ---- exercised axis ---- */
/** Which controls actually FIRED when the agent's compiled workflow is run under the kernel. */
export function exercisedForAgent(m: AgentManifest): Set<string> {
  const set = new Set<string>();
  const t = runWorkflowSpec(compileManifestToWorkflow(m));
  const steps = t.steps;
  const logged = steps.length > 0 && steps.every((s) => s.guardEvaluations.length > 0);
  const verified = steps.some((s) => s.outcome === "verified");
  const oversight = steps.some((s) => s.action.id === "approve") || t.terminal.kind === "Escalate";
  const technical = steps.some((s) => s.guardEvaluations.some((g) => g.fired) || s.outcome === "blocked") || steps.some((s) => s.guardEvaluations.length > 0);
  if (oversight) { set.add("eu-ai-act-art14-oversight"); set.add("sg-mgf-human-accountability"); }
  if (logged) set.add("eu-ai-act-logging");
  if (verified) { set.add("mas-deterministic-verification"); set.add("nist-ai-rmf-measure"); }
  if (technical) set.add("sg-mgf-technical-controls");
  return set;
}
/** Model controls are "exercised" when independent validation / monitoring were actually performed. */
export function exercisedForModel(m: ModelManifest): Set<string> {
  const set = new Set<string>();
  if (m.validation?.status === "validated" || m.validation?.status === "exempt") set.add("sr-11-7-independent-validation");
  const d = m.recency?.driftStatus;
  if (d === "stable" || d === "watch" || d === "breach") set.add("mas-aimrm-ongoing-monitoring");
  return set;
}

/* ---- declared × exercised fusion ---- */
export type Verdict = "binding" | "unverified" | "shadow" | "gap";
export function combine(declared: boolean, exercised: boolean): Verdict {
  return declared && exercised ? "binding" : declared ? "unverified" : exercised ? "shadow" : "gap";
}
export interface CombinedCell extends CoverageCell {
  readonly declared: boolean;
  readonly exercised: boolean;
  readonly verdict: Verdict;
}
export interface EstateAttestation extends InventoryAttestation {
  readonly combined: readonly CombinedCell[];
  readonly verdicts: { binding: number; unverified: number; shadow: number; gap: number };
}

/** The full estate attestation: declared matrix + exercised fusion over agents + models. */
export function combineInventory(agents: readonly AgentManifest[], models: readonly ModelManifest[]): EstateAttestation {
  const norms = [...agents.map(normaliseAgent), ...models.map(normaliseModel)];
  const base = attestInventory(norms);
  const exBy = new Map<string, Set<string>>();
  for (const a of agents) exBy.set(a.id, exercisedForAgent(a));
  for (const m of models) exBy.set(m.id, exercisedForModel(m));
  const combined: CombinedCell[] = base.matrix.map((cell) => {
    const declared = cell.status === "covered";
    const exercised = (exBy.get(cell.asset) ?? new Set()).has(cell.controlId);
    return { ...cell, declared, exercised, verdict: combine(declared, exercised) };
  });
  const verdicts = {
    binding: combined.filter((c) => c.verdict === "binding").length,
    unverified: combined.filter((c) => c.verdict === "unverified").length,
    shadow: combined.filter((c) => c.verdict === "shadow").length,
    gap: combined.filter((c) => c.verdict === "gap").length,
  };
  return { ...base, combined, verdicts };
}
