"use client";

import { Background, BackgroundVariant, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState } from "react";

type NodeType = "agent" | "model" | "data" | "egress";
interface NetNode {
  id: string; type: NodeType; label: string; sub?: string;
  severity?: "ok" | "watch" | "critical"; autonomy?: string; tier?: number | null;
  egress?: boolean; thirdParty?: boolean; degree?: number;
}
interface NetEdge { from: string; to: string; kind: "uses" | "reads" | "egress" }
interface Data { nodes: NetNode[]; edges: NetEdge[]; stats: { agents: number; sharedModels: number; sharedData: number; egress: number; critical: number } }

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold";

/* deterministic Fruchterman-Reingold force layout (circle init, no RNG) */
function layout(nodes: NetNode[], edges: NetEdge[]): Record<string, { x: number; y: number }> {
  const n = nodes.length || 1;
  const k = Math.sqrt((1200 * 820) / n) * 0.72;
  const pos: Record<string, { x: number; y: number }> = {};
  nodes.forEach((nd, i) => { const a = (i / n) * Math.PI * 2; pos[nd.id] = { x: Math.cos(a) * 320, y: Math.sin(a) * 320 }; });
  let temp = 240;
  for (let it = 0; it < 320; it++) {
    const disp: Record<string, { x: number; y: number }> = {};
    for (const nd of nodes) disp[nd.id] = { x: 0, y: 0 };
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = pos[nodes[i]!.id]!, b = pos[nodes[j]!.id]!;
      const dx = a.x - b.x, dy = a.y - b.y; const d = Math.hypot(dx, dy) || 0.01;
      const f = (k * k) / d; const ux = dx / d, uy = dy / d;
      disp[nodes[i]!.id]!.x += ux * f; disp[nodes[i]!.id]!.y += uy * f;
      disp[nodes[j]!.id]!.x -= ux * f; disp[nodes[j]!.id]!.y -= uy * f;
    }
    for (const e of edges) {
      const a = pos[e.from], b = pos[e.to]; if (!a || !b) continue;
      const dx = a.x - b.x, dy = a.y - b.y; const d = Math.hypot(dx, dy) || 0.01;
      const f = (d * d) / k; const ux = dx / d, uy = dy / d;
      disp[e.from]!.x -= ux * f; disp[e.from]!.y -= uy * f;
      disp[e.to]!.x += ux * f; disp[e.to]!.y += uy * f;
    }
    for (const nd of nodes) {
      const dd = disp[nd.id]!; const d = Math.hypot(dd.x, dd.y) || 0.01;
      pos[nd.id]!.x = (pos[nd.id]!.x + (dd.x / d) * Math.min(d, temp)) * 0.995;
      pos[nd.id]!.y = (pos[nd.id]!.y + (dd.y / d) * Math.min(d, temp)) * 0.995;
    }
    temp *= 0.985;
  }
  return pos;
}

type NetNodeData = NetNode & { dim: boolean } & Record<string, unknown>;
function NetNodeView({ data }: NodeProps<Node<NetNodeData>>) {
  const d = data;
  const sevBorder = d.type !== "agent" ? "" : d.severity === "critical" ? "border-bad" : d.severity === "watch" ? "border-warn" : "border-ok/60";
  const base = "rounded-lg border px-2.5 py-1.5 text-center shadow-[0_6px_20px_rgba(0,0,0,0.5)] transition";
  const style =
    d.type === "agent" ? `${base} bg-panel ${sevBorder} w-[150px]` :
    d.type === "model" ? `${base} bg-link/10 border-link/50 w-[130px]` :
    d.type === "data" ? `${base} bg-panel2 border-edge w-[130px]` :
    `${base} bg-bad/10 border-bad/50 w-[130px]`;
  return (
    <div className={`${style} ${d.dim ? "opacity-25" : ""}`}>
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <div className="flex items-center justify-center gap-1">
        <span className="truncate text-[11.5px] font-semibold text-fg">{d.label}</span>
        {d.type === "agent" && d.autonomy ? <span className={`${chip} ${d.severity === "critical" ? "bg-bad/20 text-bad" : d.severity === "watch" ? "bg-warn/20 text-warn" : "bg-ok/20 text-ok"}`}>{d.autonomy}</span> : null}
      </div>
      <div className="mt-0.5 flex items-center justify-center gap-1 text-[9px] text-muted">
        <span className="truncate">{d.sub}</span>
        {d.thirdParty ? <span className={`${chip} bg-warn/15 text-warn`}>3P</span> : null}
        {(d.degree ?? 0) > 1 && d.type !== "agent" ? <span className={`${chip} bg-fg/10 text-fg`}>×{d.degree}</span> : null}
        {d.egress ? <span className={`${chip} bg-bad/15 text-bad`}>egress</span> : null}
      </div>
    </div>
  );
}

const nodeTypes = { net: NetNodeView };

export default function NetworkPage() {
  const [data, setData] = useState<Data | null>(null);
  const [sel, setSel] = useState<string>("");

  useEffect(() => { void (async () => setData((await (await fetch("/api/network")).json()) as Data))(); }, []);

  const { rfNodes, rfEdges } = useMemo(() => {
    if (!data) return { rfNodes: [] as Node[], rfEdges: [] as Edge[] };
    const pos = layout(data.nodes, data.edges);
    const neighbours = new Set<string>();
    if (sel) { neighbours.add(sel); for (const e of data.edges) { if (e.from === sel) neighbours.add(e.to); if (e.to === sel) neighbours.add(e.from); } }
    const rfNodes: Node[] = data.nodes.map((n) => ({
      id: n.id, type: "net", position: pos[n.id] ?? { x: 0, y: 0 },
      data: { ...n, dim: sel !== "" && !neighbours.has(n.id) },
    }));
    const rfEdges: Edge[] = data.edges.map((e, i) => {
      const active = sel === "" || e.from === sel || e.to === sel;
      const stroke = e.kind === "egress" ? "#ff6b6b" : e.kind === "reads" ? "#5a5a5e" : "#7a7a80";
      return { id: `e${i}`, source: e.from, target: e.to, style: { stroke, strokeWidth: 1.25, strokeDasharray: e.kind === "uses" ? undefined : "4 3", opacity: active ? 0.9 : 0.12 }, animated: active && e.kind === "egress" };
    });
    return { rfNodes, rfEdges };
  }, [data, sel]);

  const selNode = data?.nodes.find((n) => n.id === sel);
  const connections = data && sel ? data.edges.filter((e) => e.from === sel || e.to === sel).map((e) => (e.from === sel ? e.to : e.from)) : [];

  return (
    <div className="flex h-[calc(100vh-150px)] flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-fg">Agent Network Map</h1>
          <p className="max-w-3xl text-[13px] text-muted">
            How the estate is wired: every agent linked to the models, data sources, and egress endpoints it uses. Shared
            resources become <span className="text-fg">hubs</span> — a third-party model used by several agents is a coupling
            (and supply-chain) risk. Agents are coloured by autonomy conformance. Click any node to isolate its connections.
          </p>
        </div>
        {data ? (
          <div className="flex gap-2 text-[11px]">
            <Stat n={data.stats.agents} label="agents" />
            <Stat n={data.stats.sharedModels} label="shared models" tone="warn" />
            <Stat n={data.stats.egress} label="egress" tone="bad" />
            <Stat n={data.stats.critical} label="critical" tone="bad" />
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-edge bg-ink">
          {!data ? (
            <div className="absolute inset-0 grid place-items-center text-[13px] text-muted">Mapping the estate…</div>
          ) : (
            <ReactFlow nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes} colorMode="dark" fitView fitViewOptions={{ padding: 0.15 }} minZoom={0.3} maxZoom={1.6} nodesConnectable={false} onNodeClick={(_, n) => setSel((s) => (s === n.id ? "" : n.id))} onPaneClick={() => setSel("")} proOptions={{ hideAttribution: true }}>
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#23232a" />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}
          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-lg border border-edge bg-panel/80 px-3 py-1.5 text-[10px] text-muted backdrop-blur">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm border border-ok/60" /> agent</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm border border-link/50 bg-link/10" /> model</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm border border-edge bg-panel2" /> data</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm border border-bad/50 bg-bad/10" /> egress</span>
            <span className="text-fg">border = autonomy (green/amber/red)</span>
          </div>
        </div>

        <div className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-xl border border-edge bg-panel">
          <div className="border-b border-edge px-4 py-2.5 text-[12px] font-semibold text-fg">{selNode ? "Node detail" : "Estate"}</div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-[12px]">
            {selNode ? (
              <>
                <div>
                  <div className="text-[13px] font-semibold text-fg">{selNode.label}</div>
                  <div className="text-[11px] text-muted">{selNode.type}{selNode.sub ? ` · ${selNode.sub}` : ""}</div>
                </div>
                {selNode.type === "agent" ? (
                  <div className="flex flex-wrap gap-1">
                    {selNode.autonomy ? <span className={`${chip} ${selNode.severity === "critical" ? "bg-bad/15 text-bad" : selNode.severity === "watch" ? "bg-warn/15 text-warn" : "bg-ok/15 text-ok"}`}>autonomy {selNode.autonomy} · {selNode.severity}</span> : null}
                    {selNode.tier ? <span className={`${chip} bg-ink text-muted`}>Tier {selNode.tier}</span> : null}
                    {selNode.egress ? <span className={`${chip} bg-bad/15 text-bad`}>egress</span> : null}
                  </div>
                ) : (
                  <div className="text-[11px] text-muted">Used by <span className="text-fg">{connections.length}</span> agent{connections.length === 1 ? "" : "s"}{(selNode.degree ?? 0) > 1 ? " — a shared hub (coupling risk)." : "."}</div>
                )}
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">Connections ({connections.length})</div>
                  <ul className="space-y-1">
                    {connections.map((c) => { const cn = data?.nodes.find((x) => x.id === c); return <li key={c}><button onClick={() => setSel(c)} className="text-left text-[11px] text-link hover:underline">{cn?.label ?? c}</button> <span className="text-[10px] text-muted">· {cn?.type}</span></li>; })}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-muted">Click an agent to see what it&rsquo;s wired to; click a shared model or data source to see every agent coupled through it. Red edges are external egress.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: "warn" | "bad" }) {
  const c = tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-fg";
  return <div className="rounded-lg border border-edge bg-panel px-2.5 py-1"><span className={`text-[15px] font-semibold tabular-nums ${c}`}>{n}</span> <span className="text-[10px] text-muted">{label}</span></div>;
}
