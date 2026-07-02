"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ---- types mirroring @ring-zero/policy orchestration output ---- */
interface GuardEval {
  guard: string;
  fired: boolean;
  score?: number;
  threshold?: number;
  advisory: boolean;
}
interface Step {
  index: number;
  action: { id: string; intent: string; kind: string };
  decision: string;
  outcome: string;
  guardEvaluations: GuardEval[];
  verifyResult?: { verified: number; detail: string };
}
type AgentStatus = "ok" | "contained" | "blocked" | "killed" | "skipped";
interface AgentRun {
  id: string;
  name: string;
  role: string;
  tier: number;
  status: AgentStatus;
  terminalKind: string;
  rationale: string;
  cot: string[];
  cotAdvisory: boolean;
  governanceNote: string;
  theta: { alignment: number; confidence: number; containment: string; dualApproval: boolean; lengthBudget: number };
  steps: Step[];
  emitted: Record<string, unknown>;
}
interface OrchestrationResult {
  pipeline: string;
  scenario: string;
  agents: AgentRun[];
  released: boolean;
  haltedAt: string | null;
}
interface MNode {
  id: string;
  name: string;
  kind: "agent" | "knowledge";
  pos: { x: number; y: number };
  defaultTier?: number;
  documents?: string[];
}
interface MEdge {
  from: string;
  to: string;
  kind: "flow" | "reference";
}
interface PipelineManifest {
  id: string;
  label: string;
  vertical: string;
  scenarios: { id: string; label: string }[];
  agents: { id: string; name: string; defaultTier: number }[];
  nodes: MNode[];
  edges: MEdge[];
}

/* monochrome (Palantir/LangChain) status palette — white pass, grey scale, small signal accents */
const STATUS: Record<AgentStatus, { label: string; dot: string; text: string; stroke: string; accent: string }> = {
  ok: { label: "GOVERNED · PASS", dot: "bg-ok", text: "text-ok", stroke: "#d6d6d8", accent: "border-t-fg/50" },
  contained: { label: "CONTAINED · ESCALATED", dot: "bg-warn", text: "text-warn", stroke: "#7a7a80", accent: "border-t-warn/70" },
  blocked: { label: "BLOCKED", dot: "bg-bad", text: "text-bad", stroke: "#5a5a5e", accent: "border-t-bad/70" },
  killed: { label: "KILLED", dot: "bg-bad", text: "text-bad", stroke: "#5a5a5e", accent: "border-t-bad/70" },
  skipped: { label: "NOT REACHED", dot: "bg-muted", text: "text-muted", stroke: "#3a3a3e", accent: "border-t-edge" },
};

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";

interface AgentNodeData extends Record<string, unknown> {
  agent: AgentRun;
  killed: boolean;
  isSelected: boolean;
  onTier: (id: string, t: number) => void;
  onKill: (id: string) => void;
  onSelect: (id: string) => void;
}

function GovernanceDial({ tier, disabled, onPick }: { tier: number; disabled: boolean; onPick: (t: number) => void }) {
  return (
    <div className="nodrag flex items-center gap-1">
      {[1, 2, 3, 4].map((t) => (
        <button
          key={t}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onPick(t);
          }}
          className={`h-5 w-6 rounded text-[10px] font-bold transition ${
            t === tier ? "bg-brand text-ink" : "bg-ink text-muted hover:text-fg"
          } ${disabled ? "opacity-40" : ""}`}
          title={`Governance level (Tier ${t})`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function AgentFlowNode({ data, selected }: NodeProps<Node<AgentNodeData>>) {
  const { agent, killed, onTier, onKill, onSelect } = data;
  const s = STATUS[agent.status];
  return (
    <div
      onClick={() => onSelect(agent.id)}
      className={`w-[252px] overflow-hidden rounded-xl border bg-panel shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition ${
        selected || data.isSelected ? "border-fg" : "border-edge hover:border-fg/40"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!top-[34px]" />
      <Handle type="source" position={Position.Right} className="!top-[34px]" />
      <Handle type="target" position={Position.Top} id="kb" className="!left-10" />

      <div className={`flex items-center gap-2 border-b border-edge bg-panel2 px-3 py-2 border-t-2 ${s.accent}`}>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-fg/10 text-fg">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="8" width="16" height="11" rx="2" />
            <path d="M12 3v3M9 13h.01M15 13h.01" />
          </svg>
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-fg">{agent.name}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onKill(agent.id);
          }}
          className={`nodrag ${chip} border ${
            killed ? "border-ok/50 bg-ok/10 text-ok" : "border-bad/50 bg-bad/10 text-bad hover:bg-bad/25"
          }`}
          title="Kill switch — halt this agent; contain everything downstream"
        >
          {killed ? "revive" : "⨯ kill"}
        </button>
      </div>

      <div className="space-y-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${s.dot} ${agent.status === "ok" ? "animate-pulse" : ""}`} />
          <span className={`${chip} bg-ink ${s.text}`}>{s.label}</span>
        </div>
        <p className="line-clamp-2 text-[11px] leading-snug text-muted">{agent.role}</p>

        <div className="flex items-center justify-between gap-2 rounded-md bg-ink/60 px-2 py-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted">Governance</span>
          <GovernanceDial tier={agent.tier} disabled={killed} onPick={(t) => onTier(agent.id, t)} />
        </div>
        <div className="flex flex-wrap gap-1 text-muted">
          <span className={`${chip} bg-ink`}>θ_A {agent.theta.alignment}</span>
          <span className={`${chip} bg-ink`}>θ_C {agent.theta.confidence}</span>
          <span className={`${chip} bg-ink`}>{agent.theta.containment}</span>
        </div>
      </div>
    </div>
  );
}

interface KnowledgeNodeData extends Record<string, unknown> {
  label: string;
  documents: string[];
}

function KnowledgeNode({ data }: NodeProps<Node<KnowledgeNodeData>>) {
  return (
    <div className="w-[210px] overflow-hidden rounded-xl border border-edge bg-panel2 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
      <Handle type="source" position={Position.Bottom} />
      <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-fg/10 text-fg">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="8" ry="3" />
            <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
          </svg>
        </span>
        <span className="text-[12px] font-semibold text-fg">Knowledge base</span>
      </div>
      <div className="px-3 py-2">
        <ul className="space-y-1 text-[10.5px] text-muted">
          {data.documents.map((d) => (
            <li key={d} className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-muted" />
              {d}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[9px] uppercase tracking-wide text-muted">reference documents</p>
      </div>
    </div>
  );
}

const nodeTypes = { agent: AgentFlowNode, knowledge: KnowledgeNode };

export default function OrchestratorPage() {
  const [manifest, setManifest] = useState<PipelineManifest[] | null>(null);
  const [pipeline, setPipeline] = useState<string>("");
  const [tiers, setTiers] = useState<Record<string, number>>({});
  const [killed, setKilled] = useState<string[]>([]);
  const [scenario, setScenario] = useState("clean");
  const [result, setResult] = useState<OrchestrationResult | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);

  const current = manifest?.find((p) => p.id === pipeline);

  // load the workflow manifest and initialise the first pipeline.
  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/orchestrate");
      const json = (await res.json()) as { pipelines: PipelineManifest[] };
      setManifest(json.pipelines);
      const first = json.pipelines[0];
      if (first) applyPipeline(first);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPipeline = (p: PipelineManifest) => {
    setPipeline(p.id);
    setTiers(Object.fromEntries(p.agents.map((a) => [a.id, a.defaultTier])));
    setKilled([]);
    setScenario("clean");
    setSelected(p.agents[Math.min(2, p.agents.length - 1)]?.id ?? "");
    setResult(null);
  };

  const key = useMemo(
    () => JSON.stringify({ pipeline, tiers, killed: [...killed].sort(), scenario }),
    [pipeline, tiers, killed, scenario],
  );

  const run = useCallback(async () => {
    if (!pipeline) return;
    setBusy(true);
    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pipeline, tiers, killed, scenario }),
      });
      const json = (await res.json()) as { ok: boolean; result?: OrchestrationResult };
      if (json.result) setResult(json.result);
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    void run();
  }, [run]);

  const onTier = useCallback((id: string, t: number) => setTiers((p) => ({ ...p, [id]: t })), []);
  const onKill = useCallback((id: string) => setKilled((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])), []);
  const onSelect = useCallback((id: string) => setSelected(id), []);

  // sync React Flow nodes/edges from the manifest topology + governed result,
  // preserving dragged positions. Handles fan-out / fan-in DAGs and a KB node.
  useEffect(() => {
    if (!result || !current) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const byId = Object.fromEntries(result.agents.map((a) => [a.id, a]));
    setNodes((prev) =>
      current.nodes
        .map((n) => {
          const ex = prev.find((p) => p.id === n.id);
          const position = ex?.position ?? n.pos;
          if (n.kind === "knowledge") {
            return { id: n.id, type: "knowledge", position, data: { label: n.name, documents: n.documents ?? [] } } as Node;
          }
          const agent = byId[n.id];
          if (!agent) return null;
          return {
            id: n.id,
            type: "agent",
            position,
            data: { agent, killed: killed.includes(n.id), isSelected: n.id === selected, onTier, onKill, onSelect },
          } as Node;
        })
        .filter((n): n is Node => n !== null),
    );
    setEdges(
      current.edges.map((e) => {
        if (e.kind === "reference") {
          return {
            id: `${e.from}->${e.to}:ref`,
            source: e.from,
            target: e.to,
            targetHandle: "kb",
            animated: false,
            label: "reference",
            labelStyle: { fill: "#8a8a90", fontSize: 10 },
            labelBgStyle: { fill: "#0a0a0b" },
            style: { stroke: "#3a3a3e", strokeWidth: 1.25, strokeDasharray: "3 3" },
          } as Edge;
        }
        const src = byId[e.from];
        const passed = src?.status === "ok";
        const stroke = src ? STATUS[src.status].stroke : "#3a3a3e";
        const keys = src ? Object.keys(src.emitted) : [];
        return {
          id: `${e.from}->${e.to}`,
          source: e.from,
          target: e.to,
          animated: passed,
          label: passed && keys.length ? keys.join(" · ") : src && src.status !== "ok" ? "contained" : "",
          labelStyle: { fill: "#8a8a90", fontSize: 10 },
          labelBgStyle: { fill: "#0a0a0b" },
          style: { stroke, strokeWidth: 1.5, strokeDasharray: passed ? undefined : "4 3" },
        } as Edge;
      }),
    );
  }, [result, current, selected, killed, onTier, onKill, onSelect, setNodes, setEdges]);

  const reset = () => {
    if (current) applyPipeline(current);
  };

  const agents = result?.agents ?? [];
  const sel = agents.find((a) => a.id === selected) ?? agents[0];

  return (
    <div className="flex h-[calc(100vh-150px)] flex-col gap-3">
      <StudioBar
        manifest={manifest}
        current={current}
        onPipeline={(id) => {
          const p = manifest?.find((m) => m.id === id);
          if (p) applyPipeline(p);
        }}
        scenario={scenario}
        setScenario={setScenario}
        reset={reset}
        busy={busy}
      />

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-edge bg-ink">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            colorMode="dark"
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesConnectable={false}
            edgesFocusable={false}
            proOptions={{ hideAttribution: true }}
            minZoom={0.4}
            maxZoom={1.6}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#23232a" />
            <Controls showInteractive={false} position="bottom-center" orientation="horizontal" />
          </ReactFlow>

          <div className="pointer-events-none absolute left-3 top-3 z-10">
            <GlobalPill result={result} />
          </div>
          {agents.length === 0 ? (
            <div className="absolute inset-0 grid place-items-center text-[13px] text-muted">Initialising governed run…</div>
          ) : null}
        </div>

        <OutputPanel result={result} sel={sel} />
      </div>
    </div>
  );
}

function StudioBar({
  manifest,
  current,
  onPipeline,
  scenario,
  setScenario,
  reset,
  busy,
}: {
  manifest: PipelineManifest[] | null;
  current?: PipelineManifest;
  onPipeline: (id: string) => void;
  scenario: string;
  setScenario: (s: string) => void;
  reset: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-panel px-3 py-2">
      <div className="flex items-center gap-2">
        <a href="/" className="grid h-7 w-7 place-items-center rounded-lg border border-edge text-muted hover:text-fg" title="Back">
          ‹
        </a>
        <span className="text-fg/40">∗</span>
        <select
          value={current?.id ?? ""}
          onChange={(e) => onPipeline(e.target.value)}
          className="rounded-lg border border-edge bg-ink px-2 py-1.5 text-[13px] font-semibold text-fg"
          title="Workflow"
        >
          {(manifest ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <span className="hidden text-[11px] text-muted sm:inline">{current?.vertical}</span>
        <span className="ml-1 text-[11px] text-muted">{busy ? "· re-running…" : "· governed"}</span>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          className="rounded-lg border border-edge bg-ink px-2 py-1.5 text-[12px] text-fg"
          title="Scenario"
        >
          {(current?.scenarios ?? [{ id: "clean", label: "Clean run" }]).map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button onClick={reset} className="grid h-8 w-8 place-items-center rounded-lg border border-edge text-muted hover:text-fg" title="Reset governance">
          ⌫
        </button>
        <a href="/frameworks" className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-ink" title="Governance frameworks">
          ⚙
        </a>
      </div>
    </div>
  );
}

function GlobalPill({ result }: { result: OrchestrationResult | null }) {
  if (!result) return null;
  const released = result.released;
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 backdrop-blur ${
        released ? "border-ok/40 bg-ok/10" : "border-warn/40 bg-warn/10"
      }`}
    >
      <span className={`${chip} ${released ? "bg-ok/20 text-ok" : "bg-warn/20 text-warn"}`}>
        {released ? "RELEASED" : "CONTAINED"}
      </span>
      <span className="text-[11px] text-fg">
        {released ? "Completed — all agents passed governance." : `Contained at ${result.haltedAt}. No release.`}
      </span>
    </div>
  );
}

function OutputPanel({ result, sel }: { result: OrchestrationResult | null; sel: AgentRun | undefined }) {
  return (
    <div className="flex w-[360px] shrink-0 flex-col overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
        <h2 className="text-[12px] font-semibold text-fg">Governed Output</h2>
        <span className="text-[10px] text-muted">deterministic · LLM-free</span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {(result?.agents ?? []).map((a) => {
          const s = STATUS[a.status];
          return (
            <div key={a.id} className="flex gap-2">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${s.dot}/20`}>
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              </span>
              <div className="min-w-0 flex-1 rounded-lg rounded-tl-sm border border-edge bg-panel2 px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-fg">{a.name}</span>
                  <span className={`${chip} bg-ink ${s.text}`}>{s.label}</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted">{a.rationale}</p>
              </div>
            </div>
          );
        })}

        {sel ? (
          <div className="space-y-3 border-t border-edge pt-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Chain of thought</h3>
                <span className={`${chip} bg-fg/10 text-fg`}>advisory · off binding path</span>
              </div>
              <ol className="space-y-1">
                {sel.cot.map((c, i) => (
                  <li key={i} className="flex gap-2 text-[11.5px] text-fg">
                    <span className="text-muted">{i + 1}.</span>
                    <span className="leading-snug">{c}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Kernel guards · {sel.name}</h3>
              {sel.steps.length === 0 ? (
                <p className="text-[11px] text-muted">No binding steps — agent {sel.status}.</p>
              ) : (
                <div className="space-y-1.5">
                  {sel.steps.map((st) => (
                    <div key={st.index} className="rounded-md border border-edge bg-ink/50 p-1.5 font-mono text-[10.5px]">
                      <div className="flex items-center justify-between">
                        <span className="text-fg">[{st.index}] {st.action.id}</span>
                        <span className={st.outcome === "blocked" ? "text-bad" : st.outcome === "verified" ? "text-ok" : "text-muted"}>
                          {st.outcome}
                        </span>
                      </div>
                      {st.verifyResult ? <div className="text-muted">verifier: {st.verifyResult.detail}</div> : null}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {st.guardEvaluations.map((g, i) => (
                          <span key={i} className={`${chip} ${g.fired ? "bg-warn/15 text-warn" : "bg-panel2 text-muted"}`}>
                            {g.guard}
                            {g.fired ? " ◂" : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-edge px-4 py-2.5 text-[11px] text-muted">
        Governance is driven on the canvas — drag a level, trip a scenario, or kill an agent.
      </div>
    </div>
  );
}
