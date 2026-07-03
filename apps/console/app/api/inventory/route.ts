import { discoverAll, discoverModels } from "@ring-zero/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * MAS AI RG AI-asset inventory: agents + models, normalised to one schema, with
 * inventory metadata (purpose, data categories, lifecycle, materiality, third-party).
 * In production the connectors call each platform's API / model registry.
 */
export function GET(): NextResponse {
  return NextResponse.json({ ok: true, agents: discoverAll(), models: discoverModels() });
}
