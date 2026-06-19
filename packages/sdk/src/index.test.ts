import {
  edgeKey,
  makeState,
  mintApproval,
  type Action,
  type Edge,
  type Theta,
  type TransitionSystem,
} from "@ring-zero/kernel";
import { Gateway, IdentityRegistry } from "@ring-zero/mediation";
import { describe, expect, it } from "vitest";
import { PACKAGE, RingZeroClient, STANCE, type ToolInvocation } from "./index.js";

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
const theta: Theta = {
  tier: 3,
  thresholds: { Alignment: 0.8, Confidence: 0.7, Information: 0.5 },
  Lmax: 16,
  defaultContainment: "Escalate",
  requireDualApproval: false,
  verifierTimeoutMs: 1000,
};
const approved = makeState({
  node: "approved",
  attrs: { Alignment: 1, Verified: 1, Length: 1, Information: 1, Confidence: 1 },
  flags: { sensitiveData: false, approvalRecord: mintApproval({ id: "a1", approver: "officer", subjectNode: "approved" }) },
});
const inv: ToolInvocation = {
  capabilityId: "C4",
  operation: "release",
  intent: "dispatch",
  requiredScopes: ["memo:release"],
  actionId: "C4.release",
};

describe("@ring-zero/sdk — complete mediation client", () => {
  it("identity + stance", () => {
    expect(PACKAGE).toBe("@ring-zero/sdk");
    expect(STANCE).toBe("THIN");
  });

  it("advances state when the gateway permits", () => {
    const identities = new IdentityRegistry().register({
      agentId: "memo-agent",
      supervisingUser: "u1",
      grantedScopes: ["memo:release"],
    });
    const client = new RingZeroClient("memo-agent", new Gateway(W, { identities }), theta, approved);
    const r = client.route(inv);
    expect(r.applied).toBe(true);
    expect(r.state.node).toBe("released");
  });

  it("does NOT advance state when the gateway denies (out of scope)", () => {
    const identities = new IdentityRegistry().register({
      agentId: "reader",
      supervisingUser: "u1",
      grantedScopes: ["source:read"],
    });
    const client = new RingZeroClient("reader", new Gateway(W, { identities }), theta, approved);
    const r = client.route(inv);
    expect(r.applied).toBe(false);
    expect(r.state.node).toBe("approved");
  });
});
