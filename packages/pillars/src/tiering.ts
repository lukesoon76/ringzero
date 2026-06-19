/**
 * P2 — Risk assessment & tiering. A REAL 5-dimension scorer (agency, authority,
 * impact, exposure, recoverability per Szpruch §2.1) → Tier 1–4, wired to the
 * kernel's enforcement intensity via Θ. Higher tier ⇒ stricter Θ, Escalate
 * containment, and (Tier 4) dual approval. This linkage is the demoable point:
 * changing the tier changes what the kernel/gateway will permit.
 */

import type { Theta, Tier } from "@ring-zero/kernel";
import { thetaForTier } from "@ring-zero/policy";

export interface RiskDimensions {
  readonly agency: number; // 0–3: autonomy of action
  readonly authority: number; // 0–3: power granted
  readonly impact: number; // 0–3: blast radius
  readonly exposure: number; // 0–3: external reach
  readonly recoverability: number; // 0–3: how hard to undo (higher = harder)
}

const DIMENSIONS = ["agency", "authority", "impact", "exposure", "recoverability"] as const;

export interface TierAssessment {
  readonly tier: Tier;
  readonly total: number; // 0–15
  readonly rationale: string;
}

export function scoreToTier(d: RiskDimensions): TierAssessment {
  const clamp = (x: number): number => Math.max(0, Math.min(3, Math.round(x)));
  const total = DIMENSIONS.reduce((sum, k) => sum + clamp(d[k]), 0);
  const tier: Tier = total <= 3 ? 1 : total <= 7 ? 2 : total <= 11 ? 3 : 4;
  return {
    tier,
    total,
    rationale: `Σ(agency,authority,impact,exposure,recoverability) = ${total}/15 ⇒ Tier ${tier}`,
  };
}

export interface EnforcementProfile {
  readonly tier: Tier;
  readonly theta: Theta;
  readonly defaultDeny: true;
  readonly dualApproval: boolean;
  readonly containment: Theta["defaultContainment"];
  readonly lengthBudget: number;
  readonly alignmentThreshold: number;
}

/** Resolve a tier to its concrete enforcement intensity (the Θ the kernel uses). */
export function enforcementProfile(tier: Tier): EnforcementProfile {
  const theta = thetaForTier(tier);
  return {
    tier,
    theta,
    defaultDeny: true,
    dualApproval: theta.requireDualApproval,
    containment: theta.defaultContainment,
    lengthBudget: theta.Lmax,
    alignmentThreshold: theta.thresholds.Alignment,
  };
}
