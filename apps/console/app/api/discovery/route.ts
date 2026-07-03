import { discoverAll } from "@ring-zero/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Universal agent discovery. In production each connector calls its platform's
 * management API / telemetry; here they return normalised fixtures. Optional
 * `?sources=aws-bedrock,azure-ai-agents` filters the sweep.
 */
export function GET(req: Request): NextResponse {
  const raw = new URL(req.url).searchParams.get("sources");
  const sources = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  return NextResponse.json({ ok: true, manifests: discoverAll(sources) });
}
