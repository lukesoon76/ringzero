/**
 * The credit-memo (U3) policy — the spine the Phase 6 side-by-side demo realises.
 *
 * Forward path: s0_start --C1.extract--> s1_extracted --C2.retrieve-->
 * s2_retrieved --C4.draft--> s3_drafted --approve--> s4_approved --C4.release-->
 * s5_released. RELEASE is defined ONLY from the approved node, so
 * δ(s3_drafted, "C4.release") throws — mirroring "s3 --release--> ∉ δ".
 *
 * Phase 1 effects are deterministic stand-ins so the kernel, the guard loop, the
 * trajectory constraints and containment are fully exercisable without an LLM or
 * the Python verifier. Attacks are driven by the SEED state (stale data,
 * double-counted EBITDA, verbal approval); the structural prohibition is shown
 * by the undefined-transition test.
 */

import {
  makeState,
  mintApproval,
  type GovernedState,
  type TransitionEffect,
  type TransitionGuard,
  type TransitionSystem,
} from "@ring-zero/kernel";
import { capabilityAction, controlAction, definePolicy } from "./dsl.js";

export const NODES = {
  start: "s0_start",
  extracted: "s1_extracted",
  retrieved: "s2_retrieved",
  drafted: "s3_drafted",
  approved: "s4_approved",
  released: "s5_released",
} as const;

export const ACTIONS = {
  extract: capabilityAction("C1", "extract", "read"),
  retrieve: capabilityAction("C2", "retrieve", "retrieve"),
  draft: capabilityAction("C4", "draft", "compute"),
  approve: controlAction("approve", "control"),
  release: capabilityAction("C4", "release", "dispatch"),
} as const;

const extractEffect: TransitionEffect = () => ({
  attrs: { Alignment: 0.5, Information: 0.6 },
  data: { extracted: true },
});

const retrieveEffect: TransitionEffect = () => ({
  attrs: { Alignment: 1, Information: 0.9 },
  data: { retrieved: true },
});

const draftEffect: TransitionEffect = () => ({
  data: { draft: "credit-memo draft v1" },
});

const approveEffect: TransitionEffect = (state) => {
  // An authenticated approval EVENT mints a signed record. A conversational /
  // verbal "approval" (authenticatedApproval !== true) cannot — its record fails
  // signature verification, so the release constraint blocks it.
  const authentic = state.data["authenticatedApproval"] === true;
  const record = authentic
    ? mintApproval({ id: "appr-1", approver: "2lod-risk-officer", subjectNode: NODES.approved })
    : {
        id: "verbal-1",
        approver: "caller-on-the-phone",
        subjectNode: NODES.approved,
        signature: "verbal-unsigned",
      };
  return { flags: { approvalRecord: record } };
};

const releaseEffect: TransitionEffect = () => ({ data: { released: true } });

const allowlistRecencyGuard: TransitionGuard = {
  name: "source-allowlist+recency",
  check(state) {
    const allowlisted = state.data["sourceAllowlisted"] === true;
    const recencyRaw = state.data["recencyMonths"];
    const recency = typeof recencyRaw === "number" ? recencyRaw : Number.POSITIVE_INFINITY;
    const maxMonths = 18;
    const pass = allowlisted && recency <= maxMonths;
    return {
      pass,
      detail: `allowlisted=${allowlisted}, recencyMonths=${
        Number.isFinite(recency) ? recency : "missing"
      } (max ${maxMonths})`,
      score: Number.isFinite(recency) ? recency : undefined,
      threshold: maxMonths,
    };
  },
};

export function buildCreditMemoPolicy(): TransitionSystem {
  return definePolicy("credit-memo")
    .state(NODES.start, { initial: true })
    .state(NODES.extracted)
    .state(NODES.retrieved)
    .state(NODES.drafted)
    .state(NODES.approved)
    .state(NODES.released, { terminal: true })
    .transition({ from: NODES.start, to: NODES.extracted, action: ACTIONS.extract, effect: extractEffect })
    .transition({
      from: NODES.extracted,
      to: NODES.retrieved,
      action: ACTIONS.retrieve,
      effect: retrieveEffect,
      guard: allowlistRecencyGuard,
    })
    .transition({ from: NODES.retrieved, to: NODES.drafted, action: ACTIONS.draft, effect: draftEffect })
    .transition({ from: NODES.drafted, to: NODES.approved, action: ACTIONS.approve, effect: approveEffect })
    .transition({ from: NODES.approved, to: NODES.released, action: ACTIONS.release, effect: releaseEffect })
    .compile();
}

export interface SeedOptions {
  readonly recencyMonths?: number;
  readonly coverageClaimed?: number;
  readonly coverageRecomputed?: number;
  readonly authenticatedApproval?: boolean;
  readonly sourceAllowlisted?: boolean;
}

export function creditMemoSeed(opts: SeedOptions = {}): GovernedState {
  const {
    recencyMonths = 12,
    coverageClaimed = 1.82,
    coverageRecomputed = 1.82,
    authenticatedApproval = true,
    sourceAllowlisted = true,
  } = opts;
  return makeState({
    node: NODES.start,
    attrs: { Alignment: 0, Verified: 0, Length: 0, Information: 0, Confidence: 0 },
    flags: { sensitiveData: false },
    data: {
      sourceAllowlisted,
      recencyMonths,
      authenticatedApproval,
      _verify: {
        checks: [
          {
            kind: "numeric",
            label: "interest-coverage-ratio",
            claimed: coverageClaimed,
            recomputed: coverageRecomputed,
            tolerance: 0.01,
          },
        ],
      },
    },
  });
}

/** Clean governed run — walks to s5_released / Complete. */
export const seedHappyPath = creditMemoSeed();
/** Attack #1 — 26-month-stale data: the C2 recency guard blocks the retrieval. */
export const seedStaleData = creditMemoSeed({ recencyMonths: 26 });
/** Attack #3 — double-counted EBITDA (2.82 vs 1.82): the verifier escalates. */
export const seedDoubleCountedEbitda = creditMemoSeed({ coverageClaimed: 2.82, coverageRecomputed: 1.82 });
/** Attack #4 — verbal "approval confirmed": the release constraint rejects it. */
export const seedVerbalApproval = creditMemoSeed({ authenticatedApproval: false });
