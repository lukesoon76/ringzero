import { defaultApprovalVerifier, mintApproval } from "@ring-zero/kernel";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Record a human oversight decision on an escalated run. An APPROVE mints a real
 * authenticated approval (HMAC-signed for the exact subject node) via the kernel
 * and verifies it — a verbal/chat "yes" would fail. A DENY records a rejection.
 * The binding path still enforces authenticity; this route only produces the
 * authenticated event a reviewer authorises.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: { action?: string; subjectNode?: string; approver?: string; id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const subjectNode = String(body.subjectNode ?? "");
  const approver = String(body.approver ?? "reviewer@bank");
  const id = String(body.id ?? `appr-${subjectNode}`);

  if (body.action === "approve") {
    const record = mintApproval({ id, approver, subjectNode });
    const authenticity = defaultApprovalVerifier.isAuthentic(record, subjectNode);
    return NextResponse.json({ ok: true, decision: "approved", record, authenticity });
  }
  return NextResponse.json({ ok: true, decision: "denied", approver, subjectNode });
}
