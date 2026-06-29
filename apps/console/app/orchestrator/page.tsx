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
  workflowId: string;
  scenario: string;
  agents: AgentRun[];
  released: boolean;
  haltedAt: string | null;
}

const DEFAULT_TIERS: Record<string, number> = { intake: 2, retrieval: 3, analysis: 3, drafting: 2, release: 3 };
const SCENARIOS: Array<{ id: string; label: string }> = [
  { id: "clean", label: "Clean run" },
  { id: "stale-data", label: "Attack · 26-month-stale data" },
  { id: "off-allowlist", label: "Attack · off-allowlist source" },
  { id: "double-count", label: "Attack · double-counted EBITDA" },
];
const POS: Record<string, { x: number; y: number }> = {
  intake: { x: 0, y: 130 },
  retrieval: { x: 285, y: 0 },
  analysis: { x: 570, y: 190 },
  drafting: { x: 855, y: 30 },
  release: { x: 1130, y: 200 },
};
const STATUS: Record<AgentStatus, { label: string; dot: string; text: string; stroke: string; accent: string }> = {
  ok: { label: "GOVERNED · PASS", dot: "bg-ok", text: "text-ok", stroke: "#34d399", accent: "border-t-ok/70" },
  contained: { label: "CONTAINED · ESCALATED", dot: "bg-warn", text: "text-warn", stroke: "#fbbf24", accent: "border-t-warn/70" },
  blocked: { label: "BLOCKED", dot: "bg-bad", text: "text-bad", stroke: "#f87171", accent: "border-t-bad/70" },
  killed: { label: "KILLED", dot: "bg-bad", text: "text-bad", stroke: "#f87171", accent: "border-t-bad/70" },
  skipped: { label: "NOT REACHED", dot: "bg-muted", text: "text-muted", stroke: "#3a465e", accent: "border-t-edge" },
};

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";

/* ---- the data carried on each React Flow node ---- */
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
        selected || data.isSelected ? "border-brand" : "border-edge hover:border-brand/40"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!top-[34px]" />
      <Handle type="source" position={Position.Right} className="!top-[34px]" />

      {/* header */}
      <div className={`flex items-center gap-2 border-b border-edge bg-panel2 px-3 py-2 border-t-2 ${s.accent}`}>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand/15 text-brand">
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

      {/* body */}
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

const nodeTypes = { agent: AgentFlowNode };

export default function OrchestratorPage() {
  const [tiers, setTiers] = useState<Record<string, number>>(DEFAULT_TIERS);
  const [killed, setKilled] = useState<string[]>([]);
  const [scenario, setScenario] = useState("clean");
  const [result, setResult] = useState<OrchestrationResult | null>(null);
  const [selected, setSelected] = useState<string>("analysis");
  const [busy, setBusy] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AgentNodeData>>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);

  const key = useMemo(() => JSON.stringify({ tiers, killed: [...killed].sort(), scenario }), [tiers, killed, scenario]);

  const run = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tiers, killed, scenario }),
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

  // sync React Flow nodes/edges from the governed result, preserving dragged positions.
  useEffect(() => {
    if (!result) return;
    setNodes((prev) =>
      result.agents.map((a) => {
        const ex = prev.find((n) => n.id === a.id);
        return {
          id: a.id,
          type: "agent",
          position: ex?.position ?? POS[a.id] ?? { x: 0, y: 0 },
          data: { agent: a, killed: killed.includes(a.id), isSelected: a.id === selected, onTier, onKill, onSelect },
        } satisfies Node<AgentNodeData>;
      }),
    );
    setEdges(
      result.agents.slice(0, -1).map((a, i) => {
        const next = result.agents[i + 1]!;
        const passed = a.status === "ok";
        const st = STATUS[a.status];
        const keys = Object.keys(a.emitted);
        return {
          id: `${a.id}->${next.id}`,
          source: a.id,
          target: next.id,
          animated: passed,
          label: passed && keys.length ? keys.join(" · ") : "contained",
          labelStyle: { fill: passed ? "#8794ad" : st.stroke, fontSize: 10 },
          labelBgStyle: { fill: "#0a0e16" },
          style: { stroke: passed ? st.stroke : "#3a465e", strokeWidth: 1.5, strokeDasharray: passed ? undefined : "4 3" },
        } satisfies Edge;
      }),
    );
  }, [result, selected, killed, onTier, onKill, onSelect, setNodes, setEdges]);

  const reset = () => {
    setTiers(DEFAULT_TIERS);
    setKilled([]);
    setScenario("clean");
  };

  const agents = result?.agents ?? [];
  const sel = agents.find((a) => a.id === selected) ?? agents[0];

  return (
    <div className="flex h-[calc(100vh-150px)] flex-col gap-3">
      <StudioBar scenario={scenario} setScenario={setScenario} reset={reset} busy={busy} />

      <div className="flex min-h-0 flex-1 gap-3">
        {/* node canvas */}
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-edge bg-ink">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            colorMode="dark"
            fitView
            fitViewOptions={{ padding: 0.25 }}
            nodesConnectable={false}
            edgesFocusable={false}
            proOptions={{ hideAttribution: true }}
            minZoom={0.4}
            maxZoom={1.6}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1e2940" />
            <Controls showInteractive={false} position="bottom-center" orientation="horizontal" />
          </ReactFlow>

          {/* global status overlay */}
          <div className="pointer-events-none absolute left-3 top-3 z-10">
            <GlobalPill result={result} />
          </div>
          {agents.length === 0 ? (
            <div className="absolute inset-0 grid place-items-center text-[13px] text-muted">Initialising governed run…</div>
          ) : null}
        </div>

        {/* right output panel (chat-style) */}
        <OutputPanel result={result} sel={sel} />
      </div>
    </div>
  );
}

function StudioBar({
  scenario,
  setScenario,
  reset,
  busy,
}: {
  scenario: string;
  setScenario: (s: string) => void;
  reset: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-panel px-3 py-2">
      <div className="flex items-center gap-2">
        <a href="/" className="grid h-7 w-7 place-items-center rounded-lg border border-edge text-muted hover:text-fg" title="Back">
          ‹
        </a>
        <span className="text-bad">∗</span>
        <span className="text-[14px] font-semibold text-fg">Credit-Memo Pipeline</span>
        <span className="grid h-6 w-6 place-items-center rounded-md border border-edge text-muted" title="Multi-agent governed workflow">
          ✎
        </span>
        <span className="ml-1 text-[11px] text-muted">{busy ? "re-running…" : "governed · deterministic"}</span>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          className="rounded-lg border border-edge bg-ink px-2 py-1.5 text-[12px] text-fg"
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button onClick={reset} className="grid h-8 w-8 place-items-center rounded-lg border border-edge text-muted hover:text-fg" title="Reset governance">
          ⌫
        </button>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-ink" title="Governance studio">⚙</span>
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
        {released ? "Memo dispatched — all agents passed governance." : `Contained at ${result.haltedAt}. No release.`}
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
        {/* telemetry as a message stream */}
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

        {/* selected agent detail */}
        {sel ? (
          <div className="space-y-3 border-t border-edge pt-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Chain of thought</h3>
                <span className={`${chip} bg-link/15 text-link`}>advisory · off binding path</span>
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
