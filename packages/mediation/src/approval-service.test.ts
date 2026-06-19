import { DEMO_APPROVAL_KEY, defaultApprovalVerifier } from "@ring-zero/kernel";
import { describe, expect, it } from "vitest";
import { ApprovalService } from "./approval-service.js";

describe("approval service (P8)", () => {
  const service = new ApprovalService(DEMO_APPROVAL_KEY);

  it("an authenticated approval EVENT mints a record the kernel accepts", () => {
    const record = service.recordApprovalEvent({ approver: "officer", subjectNode: "s4", approvalId: "a1" });
    expect(defaultApprovalVerifier.isAuthentic(record, "s4").authentic).toBe(true);
  });

  it("a conversational signal mints NOTHING (no authenticated record)", () => {
    expect(service.submitConversationalSignal("approval confirmed, ship it")).toBeUndefined();
  });
});
