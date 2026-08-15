import { attestAutonomy, discoverAll } from "@ring-zero/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NodeType = "agent" | "model" | "data" | "egress";
interface NetNode {
  id: string;
  type: NodeType;
  label: string;
  sub?: string;
  // agent-only
  severity?: "ok" | "watch" | "critical";
  autonomy?: string;
  tier?: number | null;
  egress?: boolean;
  thirdParty?: boolean;
  degree?: number;
}
interface NetEdge { from: string; to: string; kind: "uses" | "reads" | "egress" }

/**
 * Agent-estate network: agents linked to the models, data sources, and egress
 * endpoints they use. Shared resources (a third-party model used by several
 * agents; a common data source) become hubs, so coupling and supply-chain
 * concentration are visible. Agents are coloured by autonomy conformance.
 */
export function GET(): NextResponse {
  const agents = discoverAll();
  const sev = new Map(attestAutonomy(agents).agents.map((a) => [a.agentId, a]));

  const nodes = new Map<string, NetNode>();
  const edges: NetEdge[] = [];
  const add = (n: NetNode) => { if (!nodes.has(n.id)) nodes.set(n.id, n); };
  const bump = (id: string) => { const n = nodes.get(id); if (n) n.degree = (n.degree ?? 0) + 1; };

  for (const a of agents) {
    const s = sev.get(a.id);
    const hasEgress = a.tools.some((t) => t.egress) || a.source === "otel-egress";
    add({ id: a.id, type: "agent", label: a.name, sub: a.source, severity: s?.severity, autonomy: s?.code, tier: a.materialityTier ?? null, egress: hasEgress, degree: 0 });

    for (const m of a.modelRefs ?? []) {
      add({ id: `model:${m.id}`, type: "model", label: m.id, sub: m.provider, thirdParty: m.thirdParty, degree: 0 });
      edges.push({ from: a.id, to: `model:${m.id}`, kind: "uses" });
      bump(`model:${m.id}`); bump(a.id);
    }
    for (const d of a.dataSourceRefs ?? []) {
      add({ id: `data:${d.id}`, type: "data", label: d.id, sub: `${d.class} · ${d.sensitivity}`, degree: 0 });
      edges.push({ from: a.id, to: `data:${d.id}`, kind: "reads" });
      bump(`data:${d.id}`); bump(a.id);
    }
    if (hasEgress) {
      const endpoint = a.source === "otel-egress" ? a.externalRef : "external endpoints";
      const eid = `egress:${endpoint}`;
      add({ id: eid, type: "egress", label: endpoint, sub: "egress", degree: 0 });
      edges.push({ from: a.id, to: eid, kind: "egress" });
      bump(eid); bump(a.id);
    }
  }

  const list = [...nodes.values()];
  return NextResponse.json({
    ok: true,
    nodes: list,
    edges,
    stats: {
      agents: list.filter((n) => n.type === "agent").length,
      sharedModels: list.filter((n) => n.type === "model" && (n.degree ?? 0) > 1).length,
      sharedData: list.filter((n) => n.type === "data" && (n.degree ?? 0) > 1).length,
      egress: list.filter((n) => n.type === "egress").length,
      critical: list.filter((n) => n.type === "agent" && n.severity === "critical").length,
    },
  });
}
