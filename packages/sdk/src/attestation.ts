/**
 * P6 attestation as a PURE PROJECTION of the P1 inventory record.
 *
 * The moat made literal: instead of hand-maintaining an attestation document, we
 * project each asset's bound controls × their framework mappings into a coverage
 * matrix. A clause is only "attested" if a DETERMINISTIC control covers it —
 * advisory / detective controls leave the clause a GAP (they support, but never
 * discharge, an obligation). Same substrate, no double-entry.
 */

import type { AgentManifest, BoundControl } from "./manifest.js";

export interface AttestationLine {
  readonly asset: string;
  readonly assetName: string;
  readonly framework: string;
  readonly clause: string;
  readonly control: string;
  readonly strength: BoundControl["strength"];
  readonly gap: boolean;
}

export interface ClauseCoverage {
  readonly clause: string;
  readonly status: "attested" | "advisory-only";
  readonly controls: ReadonlyArray<{ readonly label: string; readonly strength: BoundControl["strength"] }>;
}
export interface FrameworkCoverage {
  readonly framework: string;
  readonly clauses: readonly ClauseCoverage[];
  readonly attested: number;
  readonly total: number;
  readonly coveragePct: number;
}
export interface AssetAttestation {
  readonly asset: string;
  readonly assetName: string;
  readonly generatedFrom: "inventory controls";
  readonly lines: readonly AttestationLine[];
  readonly frameworks: readonly FrameworkCoverage[];
  readonly gaps: readonly string[];
}

/** Project one inventory record into its attestation. Pure — no I/O, no clock. */
export function toAttestation(m: AgentManifest): AssetAttestation {
  const controls = m.controls ?? [];
  const lines: AttestationLine[] = controls.flatMap((c) =>
    c.satisfies.map((f) => ({
      asset: m.id,
      assetName: m.name,
      framework: f.framework,
      clause: f.clause,
      control: c.label,
      strength: c.strength,
      gap: c.strength !== "deterministic",
    })),
  );

  const byFramework = new Map<string, Map<string, { label: string; strength: BoundControl["strength"] }[]>>();
  for (const l of lines) {
    const clauses = byFramework.get(l.framework) ?? new Map();
    const list = clauses.get(l.clause) ?? [];
    list.push({ label: l.control, strength: l.strength });
    clauses.set(l.clause, list);
    byFramework.set(l.framework, clauses);
  }

  const frameworks: FrameworkCoverage[] = [...byFramework.entries()].map(([framework, clauseMap]) => {
    const clauses: ClauseCoverage[] = [...clauseMap.entries()].map(([clause, ctrls]) => ({
      clause,
      status: ctrls.some((c) => c.strength === "deterministic") ? "attested" : "advisory-only",
      controls: ctrls,
    }));
    const attested = clauses.filter((c) => c.status === "attested").length;
    return { framework, clauses, attested, total: clauses.length, coveragePct: clauses.length ? Math.round((attested / clauses.length) * 100) : 0 };
  });

  const gaps = frameworks.flatMap((f) => f.clauses.filter((c) => c.status === "advisory-only").map((c) => `${f.framework}:${c.clause} — covered only by ${c.controls.map((x) => x.strength).join("/")}, no deterministic control`));

  return { asset: m.id, assetName: m.name, generatedFrom: "inventory controls", lines, frameworks, gaps };
}

/** Aggregate framework coverage across a portfolio of inventory records. */
export function toPortfolioCoverage(manifests: readonly AgentManifest[]): ReadonlyArray<{ framework: string; attested: number; total: number; coveragePct: number }> {
  const agg = new Map<string, { attested: number; total: number }>();
  for (const m of manifests) {
    for (const f of toAttestation(m).frameworks) {
      const cur = agg.get(f.framework) ?? { attested: 0, total: 0 };
      agg.set(f.framework, { attested: cur.attested + f.attested, total: cur.total + f.total });
    }
  }
  return [...agg.entries()].map(([framework, v]) => ({ framework, attested: v.attested, total: v.total, coveragePct: v.total ? Math.round((v.attested / v.total) * 100) : 0 }));
}
