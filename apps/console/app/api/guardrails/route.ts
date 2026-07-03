import { runGuardrails } from "@ring-zero/mediation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Run content guardrail detectors. The `blocked` decision is derived ONLY from
 * deterministic detectors; advisory scores never bind (see mediation/guardrails).
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: { text?: string; requiredFields?: string[]; topicKeywords?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text : "";
  const report = runGuardrails(text, {
    requiredFields: Array.isArray(body.requiredFields) ? body.requiredFields : undefined,
    topicKeywords: Array.isArray(body.topicKeywords) ? body.topicKeywords : undefined,
  });
  return NextResponse.json({ ok: true, report });
}
