/**
 * Approval service (P8). Authenticated approval EVENTS mint a signed record that
 * the kernel will accept. A conversational / verbal "approval confirmed" is
 * routed here too — and explicitly produces NO authenticated record, so the
 * kernel's release constraint rejects it. This is the demo beat, at the seam.
 */

import { mintApproval, type ApprovalRecord, type NodeId } from "@ring-zero/kernel";
import type { EventSink } from "./events.js";

export interface ApprovalRequest {
  readonly approver: string;
  readonly subjectNode: NodeId;
  readonly approvalId: string;
}

export class ApprovalService {
  constructor(
    private readonly signingKey: string,
    private readonly sink?: EventSink,
  ) {}

  /** A real, authenticated approval event → a signed record the kernel accepts. */
  recordApprovalEvent(req: ApprovalRequest): ApprovalRecord {
    const record = mintApproval(
      { id: req.approvalId, approver: req.approver, subjectNode: req.subjectNode },
      this.signingKey,
    );
    this.sink?.emit({
      kind: "approval-event",
      agentId: req.approver,
      actionId: req.subjectNode,
      intent: "control",
      detail: `authenticated approval ${req.approvalId} by ${req.approver}`,
    });
    return record;
  }

  /**
   * A conversational signal ("approval confirmed", "go ahead") is NOT an
   * authenticated event. It mints nothing — there is no path here that returns a
   * valid record. Callers get `undefined`; the kernel constraint then blocks the
   * release.
   */
  submitConversationalSignal(text: string): undefined {
    this.sink?.emit({
      kind: "approval-rejected",
      agentId: "conversational",
      actionId: "(none)",
      intent: "control",
      detail: `conversational signal is not an authenticated approval: ${JSON.stringify(text)}`,
    });
    return undefined;
  }
}
