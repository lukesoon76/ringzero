/**
 * Authenticated approval. The demo beat (Phase 2) is that a *conversational*
 * "approval confirmed" must never authorise a release — only a signed approval
 * EVENT does. We model that here with an HMAC over the record's fields: a record
 * cannot be forged without the signing key, so a verbal/injected "approval"
 * (which has no valid signature) is structurally rejected.
 *
 * NOTE: `DEMO_APPROVAL_KEY` is a non-secret demo mechanism key, not a credential.
 * In Phase 2 the mediation gateway owns signing with an injected key; the kernel
 * only ever *verifies*.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { ApprovalRecord, NodeId } from "./model.js";

export const DEMO_APPROVAL_KEY = "ring-zero/demo-approval-mechanism/v1";

export type ApprovalFields = Pick<ApprovalRecord, "id" | "approver" | "subjectNode">;

function payload(fields: ApprovalFields): string {
  return `${fields.id}|${fields.approver}|${fields.subjectNode}`;
}

/** Deterministically sign approval fields. Only the mediation gateway should call this. */
export function signApproval(fields: ApprovalFields, key: string = DEMO_APPROVAL_KEY): string {
  return createHmac("sha256", key).update(payload(fields)).digest("hex");
}

/** Mint a fully-formed, authenticated approval record (used by mediation / tests). */
export function mintApproval(fields: ApprovalFields, key: string = DEMO_APPROVAL_KEY): ApprovalRecord {
  return { ...fields, signature: signApproval(fields, key) };
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface AuthenticityResult {
  readonly authentic: boolean;
  readonly detail: string;
}

export interface ApprovalVerifier {
  readonly name: string;
  readonly isAuthentic: (record: ApprovalRecord | undefined, forNode: NodeId) => AuthenticityResult;
}

/**
 * Default verifier: a record is authentic iff it is for the node being acted on
 * and its signature recomputes correctly. An absent record or any signature
 * mismatch (i.e. a conversational "approval") is rejected.
 */
export function makeApprovalVerifier(key: string = DEMO_APPROVAL_KEY): ApprovalVerifier {
  return {
    name: "hmac-demo",
    isAuthentic(record, forNode) {
      if (!record) return { authentic: false, detail: "no approval record (a chat signal is not an event)" };
      if (record.subjectNode !== forNode) {
        return { authentic: false, detail: `approval is for ${record.subjectNode}, not ${forNode}` };
      }
      const expected = signApproval(record, key);
      const ok = constantTimeEqualHex(expected, record.signature);
      return {
        authentic: ok,
        detail: ok ? "authenticated approval event" : "signature mismatch — not an authenticated event",
      };
    },
  };
}

export const defaultApprovalVerifier: ApprovalVerifier = makeApprovalVerifier();
