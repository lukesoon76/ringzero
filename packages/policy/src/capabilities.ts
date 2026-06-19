/**
 * The capability catalogue (C1–C4). A capability is a unit of agent work the
 * kernel can govern; each declares its intent class and the authority scope it
 * is permitted to exercise (enforced by the mediation gateway in Phase 2).
 */

import type { IntentClass } from "@ring-zero/kernel";

export interface Capability {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly intent: IntentClass;
  readonly authorityScope: readonly string[];
  readonly description: string;
}

export const C1: Capability = {
  id: "C1",
  name: "Extraction & structuring",
  version: "1.0.0",
  intent: "read",
  authorityScope: ["source:read"],
  description: "Structure source documents into typed, attributable claims.",
};

export const C2: Capability = {
  id: "C2",
  name: "Retrieval with attribution",
  version: "1.0.0",
  intent: "retrieve",
  authorityScope: ["kb:retrieve"],
  description: "Attribute claims to allowlisted, sufficiently-recent sources.",
};

export const C3: Capability = {
  id: "C3",
  name: "Deterministic numeric compute",
  version: "1.0.0",
  intent: "compute",
  authorityScope: ["compute:numeric"],
  description: "Recompute figures deterministically and verify them against claims.",
};

export const C4: Capability = {
  id: "C4",
  name: "Policy-constrained drafting & gated release",
  version: "1.0.0",
  intent: "write",
  authorityScope: ["memo:draft", "memo:release"],
  description: "Draft the memo internally and release it only behind authenticated sign-off.",
};

export const CAPABILITIES: readonly Capability[] = [C1, C2, C3, C4];
