import { discoverAll, evaluateAgent, JURISDICTIONS, worstStatus, type AgentCompliance } from "@ring-zero/sdk";
import type { FrameworkPack } from "@ring-zero/policy";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Evaluate every discovered agent against a MESH of frameworks (the operator's
 * selection, incl. uploaded/edited packs the client sends), plus a per-jurisdiction
 * comparison. Deterministic; see @ring-zero/sdk compliance engine.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: { frameworks?: FrameworkPack[]; selectedIds?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const frameworks = Array.isArray(body.frameworks) ? body.frameworks : [];
  const byId = new Map(frameworks.map((f) => [f.id, f]));
  const selected = (body.selectedIds ?? []).map((id) => byId.get(id)).filter((f): f is FrameworkPack => Boolean(f));

  const agents = discoverAll();
  const meshed: AgentCompliance[] = agents.map((a) => evaluateAgent(a, selected));

  const portfolio = {
    breach: meshed.filter((m) => m.status === "breach").length,
    gaps: meshed.filter((m) => m.status === "gaps").length,
    compliant: meshed.filter((m) => m.status === "compliant").length,
    status: worstStatus(meshed.map((m) => m.status)),
  };

  const matrix = JURISDICTIONS.map((j) => {
    const fw = j.frameworks.map((id) => byId.get(id)).filter((f): f is FrameworkPack => Boolean(f));
    const perAgent = agents.map((a) => ({ id: a.id, name: a.name, status: evaluateAgent(a, fw).status }));
    return { id: j.id, label: j.label, region: j.region, frameworks: j.frameworks, perAgent, status: worstStatus(perAgent.map((p) => p.status)) };
  });

  return NextResponse.json({ ok: true, meshed, portfolio, matrix, jurisdictions: JURISDICTIONS });
}
