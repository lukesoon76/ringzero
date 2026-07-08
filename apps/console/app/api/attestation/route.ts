import { FRAMEWORK_LIBRARY } from "@ring-zero/policy";
import { discoverAll, toAttestation, toPortfolioCoverage } from "@ring-zero/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * P6 attestation as a PURE PROJECTION of the P1 inventory: each discovered agent's
 * bound controls → a per-framework coverage matrix (a clause is "attested" only if
 * a deterministic control covers it). Generated, not hand-maintained.
 */
export function GET(): NextResponse {
  const agents = discoverAll();
  const label = new Map(FRAMEWORK_LIBRARY.map((f) => [f.id, f.shortName]));

  const assets = agents
    .map((a) => {
      const att = toAttestation(a);
      return { id: a.id, name: a.name, source: a.source, frameworks: att.frameworks, gaps: att.gaps };
    })
    .filter((a) => a.frameworks.length > 0);

  const present = new Set(assets.flatMap((a) => a.frameworks.map((f) => f.framework)));
  const columns = FRAMEWORK_LIBRARY.filter((f) => present.has(f.id)).map((f) => ({ id: f.id, shortName: f.shortName }));
  const portfolio = toPortfolioCoverage(agents).map((p) => ({ ...p, shortName: label.get(p.framework) ?? p.framework }));

  return NextResponse.json({ ok: true, assets, columns, portfolio });
}
