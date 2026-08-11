/**
 * Per-agent autonomy conformance: does an agent's ACTUAL enforcement match what
 * its L1–L5 autonomy level requires? Higher autonomy demands stricter binding
 * controls; an L4/L5 agent governed only by advisory/detective controls is
 * "under-governed" — exactly the "high-autonomy, high-privilege deployment is a
 * critical risk environment" failure the frontier-safety frameworks warn about.
 *
 * Only DETERMINISTIC controls count toward a required safeguard (advisory and
 * detective controls are shown but never satisfy a level requirement) — the same
 * honesty rule as the estate attestation.
 */

import {
  AUTONOMY_LEVELS,
  enforcementForAutonomy,
  RED_LINES,
  type AutonomyDef,
  type AutonomyLevel,
  type RedLine,
  type RedLineId,
} from "@ring-zero/policy";
import type { AgentManifest, BoundControl } from "./manifest.js";

type ControlKind = BoundControl["kind"];

export interface ControlCheck {
  readonly kind: ControlKind;
  readonly met: boolean;
  readonly boundAs?: string;
}

export interface AgentAutonomyResult {
  readonly agentId: string;
  readonly name: string;
  readonly source: string;
  readonly level: AutonomyLevel | null; // null = unclassified
  readonly code: string; // "L1".."L5" | "unclassified"
  readonly tier: number | null;
  readonly minTier: number | null;
  readonly tierOk: boolean;
  readonly controls: readonly ControlCheck[];
  readonly requiredRedLines: readonly RedLineId[];
  readonly conforms: boolean;
  readonly gaps: readonly string[];
  readonly severity: "ok" | "watch" | "critical"; // critical = high autonomy (L4/L5) under-governed
}

const isDeterministic = (c: BoundControl) => c.strength === "deterministic";

export function checkAgentAutonomy(agent: AgentManifest): AgentAutonomyResult {
  const level = agent.autonomyLevel ?? null;
  const tier = agent.materialityTier ?? null;
  const controls = agent.controls ?? [];

  if (level === null) {
    return {
      agentId: agent.id, name: agent.name, source: agent.source, level: null, code: "unclassified",
      tier, minTier: null, tierOk: false, controls: [], requiredRedLines: [], conforms: false,
      gaps: ["Autonomy level not classified — safeguards cannot be matched to autonomy."],
      severity: agent.autonomy.canDispatchExternally ? "critical" : "watch",
    };
  }

  const def: AutonomyDef = enforcementForAutonomy(level);
  const controlChecks: ControlCheck[] = def.requiredControls.map((kind) => {
    const bound = controls.find((c) => c.kind === kind && isDeterministic(c));
    return { kind, met: !!bound, boundAs: bound?.label };
  });
  const tierOk = tier !== null && tier >= def.minTier;

  const gaps: string[] = [];
  for (const c of controlChecks) if (!c.met) gaps.push(`No deterministic ${c.kind} control (required at ${def.code}).`);
  if (!tierOk) gaps.push(`Enforcement tier ${tier ?? "?"} is below the ${def.code} minimum (Tier ${def.minTier}).`);

  const conforms = gaps.length === 0;
  const severity: AgentAutonomyResult["severity"] = conforms ? "ok" : level >= 4 ? "critical" : "watch";

  return {
    agentId: agent.id, name: agent.name, source: agent.source, level, code: def.code,
    tier, minTier: def.minTier, tierOk, controls: controlChecks,
    requiredRedLines: def.requiredRedLines, conforms, gaps, severity,
  };
}

export interface AutonomyReport {
  readonly agents: readonly AgentAutonomyResult[];
  readonly levels: readonly AutonomyDef[];
  readonly redLines: readonly RedLine[];
  readonly summary: { readonly total: number; readonly conforming: number; readonly critical: number; readonly unclassified: number };
}

/** Autonomy conformance across the whole agent inventory. */
export function attestAutonomy(agents: readonly AgentManifest[]): AutonomyReport {
  const results = agents.map(checkAgentAutonomy);
  return {
    agents: results,
    levels: AUTONOMY_LEVELS,
    redLines: RED_LINES,
    summary: {
      total: results.length,
      conforming: results.filter((r) => r.conforms).length,
      critical: results.filter((r) => r.severity === "critical").length,
      unclassified: results.filter((r) => r.level === null).length,
    },
  };
}
