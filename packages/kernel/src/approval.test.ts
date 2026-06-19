import { describe, expect, it } from "vitest";
import { defaultApprovalVerifier, makeApprovalVerifier, mintApproval } from "./approval.js";
import type { ApprovalRecord } from "./model.js";

describe("authenticated approval (the verbal-approval demo beat)", () => {
  it("accepts a minted, signed approval for its node", () => {
    const rec = mintApproval({ id: "a1", approver: "officer", subjectNode: "s4" });
    expect(defaultApprovalVerifier.isAuthentic(rec, "s4").authentic).toBe(true);
  });

  it("rejects a conversational/verbal approval with no valid signature", () => {
    const verbal: ApprovalRecord = {
      id: "v1",
      approver: "caller",
      subjectNode: "s4",
      signature: "verbal-unsigned",
    };
    expect(defaultApprovalVerifier.isAuthentic(verbal, "s4").authentic).toBe(false);
  });

  it("rejects an absent record", () => {
    expect(defaultApprovalVerifier.isAuthentic(undefined, "s4").authentic).toBe(false);
  });

  it("rejects an approval minted for a different node", () => {
    const rec = mintApproval({ id: "a1", approver: "officer", subjectNode: "s4" });
    expect(defaultApprovalVerifier.isAuthentic(rec, "s9").authentic).toBe(false);
  });

  it("rejects a record signed with a different key", () => {
    const rec = mintApproval({ id: "a1", approver: "officer", subjectNode: "s4" }, "attacker-key");
    expect(defaultApprovalVerifier.isAuthentic(rec, "s4").authentic).toBe(false);
    expect(makeApprovalVerifier("attacker-key").isAuthentic(rec, "s4").authentic).toBe(true);
  });
});
