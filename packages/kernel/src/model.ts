/**
 * The canonical governed-object model (see ../../ARCHITECTURE.md §2–§3) with
 * runtime validation. A state whose attributes are missing or out of range is
 * NOT coerced to zero — it is `unknown`, and the kernel fails closed on it.
 */

export type NodeId = string;
export type ActionId = string;
export type ApprovalId = string;

export type IntentClass =
  | "read"
  | "retrieve"
  | "compute"
  | "write"
  | "dispatch"
  | "control";

export type Tier = 1 | 2 | 3 | 4;
export type ContainmentMode = "Halt" | "Escalate" | "Abstain";

/** The five named governance signals every guard reads. */
export interface GovernedAttributes {
  readonly Alignment: number; // [0,1] — all claims evidence-backed
  readonly Verified: 0 | 1; // deterministic verification passed
  readonly Length: number; // steps consumed (budget counter), integer >= 0
  readonly Information: number; // [0,1] information-sufficiency signal
  readonly Confidence: number; // [0,1] calibrated confidence
}

/** Untrusted attribute bag at a trust boundary (capability output, external input). */
export interface RawAttributes {
  readonly Alignment?: number;
  readonly Verified?: number;
  readonly Length?: number;
  readonly Information?: number;
  readonly Confidence?: number;
}

/**
 * An authenticated approval record. The `signature` is the proof that this was a
 * deliberate, authenticated event — NOT a conversational "approval confirmed"
 * (the demo beat in Phase 2). The kernel only treats approval as real when an
 * injected ApprovalVerifier accepts this record.
 */
export interface ApprovalRecord {
  readonly id: ApprovalId;
  readonly approver: string;
  readonly subjectNode: NodeId;
  readonly signature: string;
}

export interface GovernedFlags {
  readonly sensitiveData: boolean;
  readonly approvalRecord?: ApprovalRecord;
}

export interface GovernedState {
  readonly node: NodeId;
  readonly attrs: GovernedAttributes;
  readonly flags: GovernedFlags;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface Thresholds {
  readonly Alignment: number;
  readonly Confidence: number;
  readonly Information: number;
}

/** Governance parameters Θ, resolved from the active risk tier (P2). */
export interface Theta {
  readonly tier: Tier;
  readonly thresholds: Thresholds;
  readonly Lmax: number;
  readonly defaultContainment: ContainmentMode;
  readonly requireDualApproval: boolean;
  readonly verifierTimeoutMs: number;
}

export type Validated<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };

function isUnit(x: number | undefined, name: string): Validated<number> {
  if (x === undefined) return { ok: false, reason: `missing attribute: ${name}` };
  if (typeof x !== "number" || !Number.isFinite(x)) {
    return { ok: false, reason: `non-finite attribute: ${name}` };
  }
  if (x < 0 || x > 1) return { ok: false, reason: `attribute out of [0,1]: ${name}=${x}` };
  return { ok: true, value: x };
}

/**
 * Validate an untrusted attribute bag into a typed `GovernedAttributes`, or
 * return a fail-closed reason. Every guard input passes through here.
 */
export function validateAttributes(raw: RawAttributes): Validated<GovernedAttributes> {
  const alignment = isUnit(raw.Alignment, "Alignment");
  if (!alignment.ok) return alignment;
  const information = isUnit(raw.Information, "Information");
  if (!information.ok) return information;
  const confidence = isUnit(raw.Confidence, "Confidence");
  if (!confidence.ok) return confidence;

  const { Verified, Length } = raw;
  if (Verified === undefined) return { ok: false, reason: "missing attribute: Verified" };
  if (Verified !== 0 && Verified !== 1) {
    return { ok: false, reason: `Verified must be 0 or 1, got ${Verified}` };
  }
  if (Length === undefined) return { ok: false, reason: "missing attribute: Length" };
  if (typeof Length !== "number" || !Number.isInteger(Length) || Length < 0) {
    return { ok: false, reason: `Length must be a non-negative integer, got ${Length}` };
  }

  return {
    ok: true,
    value: {
      Alignment: alignment.value,
      Information: information.value,
      Confidence: confidence.value,
      Verified,
      Length,
    },
  };
}

/** Validate a whole state (attributes + structural shape). */
export function validateState(candidate: {
  readonly node: NodeId;
  readonly attrs: RawAttributes;
  readonly flags: GovernedFlags;
  readonly data: Readonly<Record<string, unknown>>;
}): Validated<GovernedState> {
  if (typeof candidate.node !== "string" || candidate.node.length === 0) {
    return { ok: false, reason: "state has no node id" };
  }
  const attrs = validateAttributes(candidate.attrs);
  if (!attrs.ok) return attrs;
  return {
    ok: true,
    value: {
      node: candidate.node,
      attrs: attrs.value,
      flags: candidate.flags,
      data: candidate.data,
    },
  };
}

/** Construct a validated initial state, throwing if the seed is malformed (authoring-time). */
export function makeState(candidate: {
  readonly node: NodeId;
  readonly attrs: RawAttributes;
  readonly flags?: Partial<GovernedFlags>;
  readonly data?: Readonly<Record<string, unknown>>;
}): GovernedState {
  const validated = validateState({
    node: candidate.node,
    attrs: candidate.attrs,
    flags: { sensitiveData: false, ...candidate.flags },
    data: candidate.data ?? {},
  });
  if (!validated.ok) {
    throw new Error(`makeState: invalid seed state — ${validated.reason}`);
  }
  return validated.value;
}
