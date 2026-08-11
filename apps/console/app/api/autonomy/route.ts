import { attestAutonomy, discoverAll } from "@ring-zero/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Agent autonomy (L1–L5) conformance across the discovered inventory: for each
 * agent, does its bound enforcement match what its autonomy level requires? Plus
 * the red-lines catalogue (named prohibitions, each structurally or fail-closed
 * enforced). Pure projection of the P1 inventory — nothing hand-maintained.
 */
export function GET(): NextResponse {
  return NextResponse.json({ ok: true, ...attestAutonomy(discoverAll()) });
}
