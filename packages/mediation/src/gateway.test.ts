import {
  edgeKey,
  makeState,
  mintApproval,
  type Action,
  type ApprovalRecord,
  type Edge,
  type GovernedState,
  type Theta,
  type TransitionSystem,
} from "@ring-zero/kernel";
import { describe, expect, it } from "vitest";
import { Gateway, type ToolRequest } from "./gateway.js";
import { IdentityRegistry } from "./identity.js";

const release: Action = { id: "C4.release", kind: "capability", intent: "dispatch", capabilityId: "C4" };
const edge: Edge = { from: "approved", to: "released", action: release, effect: () => ({ data: { released: true } }), priority: 0 };
const W: TransitionSystem = {
  id: "t",
  s0: "approved",
  nodes: new Set(["approved", "released"]),
  actions: new Set(["C4.release"]),
  edges: new Map([[edgeKey("approved", "C4.release"), edge]]),
  outgoing: new Map([["approved", [edge]]]),
  terminals: new Set(["released"]),
};

const theta3: Theta = {
  tier: 3,
  thresholds: { Alignment: 0.8, Confidence: 0.7, Information: 0.5 },
  Lmax: 16,
  defaultContainment: "Escalate",
  requireDualApproval: false,
  verifierTimeoutMs: 1000,
};
const theta4: Theta = { ...theta3, tier: 4, requireDualApproval: true };

const identities = new IdentityRegistry()
  .register({ agentId: "memo-agent", supervisingUser: "u1", grantedScopes: ["memo:draft", "memo:release"] })
  .register({ agentId: "reader", supervisingUser: "u1", grantedScopes: ["source:read"] });

const gateway = new Gateway(W, { identities });

const baseAttrs = { Alignment: 1, Verified: 1 as const, Length: 1, Information: 1, Confidence: 1 };
const verbal: ApprovalRecord = { id: "v1", approver: "caller", subjectNode: "approved", signature: "verbal" };

const approvedAuthentic: GovernedState = makeState({
  node: "approved",
  attrs: baseAttrs,
  flags: { sensitiveData: false, approvalRecord: mintApproval({ id: "a1", approver: "officer", subjectNode: "approved" }) },
});
const approvedVerbal: GovernedState = makeState({
  node: "approved",
  attrs: baseAttrs,
  flags: { sensitiveData: false, approvalRecord: verbal },
});

const releaseReq: ToolRequest = {
  agentId: "memo-agent",
  capabilityId: "C4",
  operation: "release",
  intent: "dispatch",
  requiredScopes: ["memo:release"],
  actionId: "C4.release",
};

describe("complete-mediation gateway", () => {
  it("denies an unknown agent (default-deny on identity)", () => {
    const d = gateway.mediate(approvedAuthentic, theta3, { ...releaseReq, agentId: "ghost" });
    expect(d.permitted).toBe(false);
    expect(d.reason).toMatch(/unknown agent/);
  });

  it("blocks an out-of-scope tool call", () => {
    const d = gateway.mediate(approvedAuthentic, theta3, { ...releaseReq, agentId: "reader" });
    expect(d.permitted).toBe(false);
    expect(d.authz.scopeSatisfied).toBe(false);
    expect(d.reason).toMatch(/out-of-scope/);
  });

  it("a verbal 'approval confirmed' does NOT authorise release", () => {
    const d = gateway.mediate(approvedVerbal, theta3, releaseReq);
    expect(d.permitted).toBe(false);
    expect(d.reason).toMatch(/authenticated sign-off|signature/);
  });

  it("permits release with an authenticated approval", () => {
    const d = gateway.mediate(approvedAuthentic, theta3, releaseReq);
    expect(d.permitted).toBe(true);
  });

  it("denies an over-permissioned request: Tier 4 dispatch without dual approval", () => {
    const d = gateway.mediate(approvedAuthentic, theta4, releaseReq);
    expect(d.permitted).toBe(false);
    expect(d.reason).toMatch(/dual approval/);
  });

  it("fails closed on an unrecognised/undefined transition", () => {
    const d = gateway.mediate(approvedAuthentic, theta3, { ...releaseReq, actionId: "C4.bogus" });
    expect(d.permitted).toBe(false);
    expect(d.recognised).toBe(false);
  });

  it("executes δ only when permitted", () => {
    const { decision, next } = gateway.execute(approvedAuthentic, theta3, releaseReq);
    expect(decision.permitted).toBe(true);
    expect(next?.node).toBe("released");
  });
});
