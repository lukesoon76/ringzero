import { runCustomGraph, type CustomGraph, type CustomNodeKind, type GovernanceLevel } from "@ring-zero/policy";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIERS = new Set([1, 2, 3, 4]);
const KINDS = new Set<CustomNodeKind>(["start", "agent", "validator", "tool", "knowledge", "guard", "approval", "consolidator", "end"]);

/**
 * Run a USER-BUILT workflow graph through the same deterministic kernel as the
 * built-in pipelines. The graph is compiled to a governed Pipeline server-side
 * (node kind → intent → binding constraints); no imported code executes, and
 * the LLM is never on the binding path. Fail-closed on malformed input.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: { graph?: unknown; tiers?: Record<string, number>; killed?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "request body is not valid JSON" }, { status: 400 });
  }

  const raw = body.graph as Partial<CustomGraph> | undefined;
  if (!raw || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
    return NextResponse.json({ ok: false, error: "graph must have nodes[] and edges[]" }, { status: 400 });
  }

  // Sanitise: keep only well-formed nodes/edges with known kinds.
  const nodes = raw.nodes
    .filter((n): n is CustomGraph["nodes"][number] => !!n && typeof n.id === "string" && KINDS.has(n.kind as CustomNodeKind) && typeof n.label === "string")
    .map((n) => ({ id: n.id, kind: n.kind, label: n.label, ...(n.tier && TIERS.has(n.tier) ? { tier: n.tier as GovernanceLevel } : {}) }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = raw.edges.filter((e): e is CustomGraph["edges"][number] => !!e && ids.has(e.from) && ids.has(e.to));

  const tiers: Record<string, GovernanceLevel> = {};
  for (const [id, t] of Object.entries(body.tiers ?? {})) if (TIERS.has(t)) tiers[id] = t as GovernanceLevel;
  const killed = Array.isArray(body.killed) ? body.killed.filter((x): x is string => typeof x === "string") : [];

  const graph: CustomGraph = { id: "__custom__", label: typeof raw.label === "string" ? raw.label : "Custom workflow", nodes, edges };
  try {
    return NextResponse.json({ ok: true, result: runCustomGraph(graph, { tiers, killed }) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
