/**
 * Tier → Θ map (the P2 control-intensity linkage the kernel reads).
 *
 * Higher tiers raise enforcement intensity: stricter thresholds, smaller length
 * budgets, Escalate-rather-than-Halt containment, and (Tier 4) mandatory dual
 * approval. Phase 5 wires the 5-dimension risk scorer to pick the tier; this map
 * is what that choice resolves to.
 */

import type { Theta, Tier } from "@ring-zero/kernel";

export function thetaForTier(tier: Tier): Theta {
  switch (tier) {
    case 1:
      return {
        tier,
        thresholds: { Alignment: 0.7, Confidence: 0.6, Information: 0.4 },
        Lmax: 20,
        defaultContainment: "Halt",
        requireDualApproval: false,
        verifierTimeoutMs: 2000,
      };
    case 2:
      return {
        tier,
        thresholds: { Alignment: 0.8, Confidence: 0.7, Information: 0.5 },
        Lmax: 16,
        defaultContainment: "Halt",
        requireDualApproval: false,
        verifierTimeoutMs: 1500,
      };
    case 3:
      return {
        tier,
        thresholds: { Alignment: 0.8, Confidence: 0.7, Information: 0.5 },
        Lmax: 16,
        defaultContainment: "Escalate",
        requireDualApproval: false,
        verifierTimeoutMs: 1500,
      };
    case 4:
      return {
        tier,
        thresholds: { Alignment: 0.9, Confidence: 0.8, Information: 0.6 },
        Lmax: 12,
        defaultContainment: "Escalate",
        requireDualApproval: true,
        verifierTimeoutMs: 1000,
      };
  }
}
