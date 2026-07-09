"use client";

import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";

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

/* ============================================================================
 * Node library — the vocabulary you compose an agentic workflow from. Each type
 * carries the governance Regent binds to it (that's the whole pitch: LangChain
 * for building, Regent for governing).
 * ========================================================================== */
type NodeKind = "start" | "agent" | "validator" | "tool" | "knowledge" | "guard" | "approval" | "consolidator" | "end";

interface CatalogEntry {
  kind: NodeKind;
  label: string;
  blurb: string;
  binds: string;
  strength: "deterministic" | "advisory" | "gate" | "none";
  group: "Flow" | "Capability" | "Governance";
  tierable: boolean;
}

const NODE_CATALOG: CatalogEntry[] = [
  { kind: "start", label: "Start", blurb: "Workflow entry point.", binds: "Trace root — run identity minted.", strength: "none", group: "Flow", tierable: false },
  { kind: "agent", label: "Agent", blurb: "LLM agent — reasons and acts.", binds: "Tier-scaled guards: alignment, confidence, length budget.", strength: "advisory", group: "Flow", tierable: true },
  { kind: "validator", label: "Validator", blurb: "Deterministic checker — Pass / Fail with justification.", binds: "Logical verifier — fail-closed on unverified.", strength: "deterministic", group: "Flow", tierable: true },
  { kind: "consolidator", label: "Consolidator", blurb: "Aggregates upstream results into one output.", binds: "Numeric reconciliation verifier — no silent overrides.", strength: "deterministic", group: "Flow", tierable: false },
  { kind: "end", label: "End", blurb: "Workflow exit / release point.", binds: "Release gate — attestation emitted from the run.", strength: "gate", group: "Flow", tierable: false },
  { kind: "tool", label: "Tool", blurb: "External tool / API call.", binds: "Gateway mediation — default-deny least privilege.", strength: "deterministic", group: "Capability", tierable: false },
  { kind: "knowledge", label: "Knowledge base", blurb: "Reference documents grounding decisions.", binds: "Provenance + staleness check on retrieved docs.", strength: "deterministic", group: "Capability", tierable: false },
  { kind: "guard", label: "Guard", blurb: "Policy checkpoint between steps.", binds: "Deterministic gate — fail-closed on unknown state.", strength: "deterministic", group: "Governance", tierable: false },
  { kind: "approval", label: "Human approval", blurb: "Authenticated oversight gate.", binds: "P8 — signed human decision required to proceed.", strength: "gate", group: "Governance", tierable: false },
];
const CATALOG_BY_KIND = Object.fromEntries(NODE_CATALOG.map((c) => [c.kind, c])) as Record<NodeKind, CatalogEntry>;
const STRENGTH_CLS: Record<CatalogEntry["strength"], string> = {
  deterministic: "bg-ok/15 text-ok",
  advisory: "bg-warn/15 text-warn",
  gate: "bg-link/15 text-link",
  none: "bg-ink text-muted",
};

function KindIcon({ kind, size = 15 }: { kind: NodeKind; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "start":
      return <svg {...p}><circle cx="12" cy="12" r="8" /><path d="M10 9l5 3-5 3z" fill="currentColor" /></svg>;
    case "end":
      return <svg {...p}><circle cx="12" cy="12" r="8" /><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" /></svg>;
    case "agent":
      return <svg {...p}><rect x="4" y="8" width="16" height="11" rx="2" /><path d="M12 3v3M9 13h.01M15 13h.01" /></svg>;
    case "validator":
      return <svg {...p}><path d="M9 12l2 2 4-5" /><rect x="4" y="4" width="16" height="16" rx="3" /></svg>;
    case "consolidator":
      return <svg {...p}><path d="M4 6h16M7 12h10M10 18h4" /></svg>;
    case "tool":
      return <svg {...p}><path d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 005.4-5.4l-2.3 2.3-2-2z" /></svg>;
    case "knowledge":
      return <svg {...p}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>;
    case "guard":
      return <svg {...p}><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></svg>;
    case "approval":
      return <svg {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0113 0" /></svg>;
  }
}

/* ---- imported-workflow onboarding (from the Import page) ---- */
const IMPORTED_WORKFLOW = "regent-imported-workflow";
type ImportedStep = Step & { fromNode: string; toNode: string };
interface ImportedPayload {
  label: string;
  format: string;
  tier: number;
  nodes: { id: string; name: string; kind: string }[];
  edges: { from: string; to: string }[];
  trajectory: { terminal: { node: string; kind: string; detail: string }; steps: ImportedStep[] };
}
function thetaFor(tier: number) {
  const m: Record<number, { a: number; c: number; cont: string }> = { 1: { a: 0.7, c: 0.6, cont: "Halt" }, 2: { a: 0.8, c: 0.7, cont: "Halt" }, 3: { a: 0.8, c: 0.7, cont: "Escalate" }, 4: { a: 0.9, c: 0.8, cont: "Escalate" } };
  const t = m[tier] ?? m[3]!;
  return { alignment: t.a, confidence: t.c, containment: t.cont, dualApproval: tier === 4, lengthBudget: tier === 4 ? 12 : 16 };
}
function importedManifest(p: ImportedPayload): PipelineManifest {
  return {
    id: "__imported__",
    label: `Imported: ${p.label}`,
    vertical: `${p.format} (imported)`,
    scenarios: [{ id: "clean", label: "Governed dry-run" }],
    agents: p.nodes.map((n) => ({ id: n.id, name: n.name, defaultTier: p.tier })),
    nodes: p.nodes.map((n) => ({ id: n.id, name: n.name, kind: n.kind === "knowledge" ? "knowledge" : "agent", pos: { x: 0, y: 0 }, defaultTier: p.tier })),
    edges: p.edges.map((e) => ({ from: e.from, to: e.to, kind: "flow" as const })),
  };
}
function synthesizeImported(p: ImportedPayload): OrchestrationResult {
  const term = p.trajectory.terminal;
  const reached = new Set<string>();
  for (const s of p.trajectory.steps) { reached.add(s.fromNode); reached.add(s.toNode); }
  const theta = thetaFor(p.tier);
  const agents: AgentRun[] = p.nodes.map((n) => {
    let status: AgentStatus;
    if (n.id === term.node && term.kind !== "Complete") status = term.kind === "Escalate" ? "contained" : "blocked";
    else if (reached.has(n.id)) status = "ok";
    else status = "skipped";
    return {
      id: n.id, name: n.name, role: `imported ${n.kind}`, tier: p.tier, status,
      terminalKind: status === "ok" ? "Complete" : term.kind,
      rationale: status === "ok" ? "Governed pass (imported dry-run)." : `${term.kind} — ${term.detail}`,
      cot: [`Imported ${p.format} node "${n.name}".`], cotAdvisory: true,
      governanceNote: "Imported workflow — per-agent governance levers apply to curated pipelines; this is a governed dry-run.",
      theta, steps: p.trajectory.steps.filter((s) => s.toNode === n.id || s.fromNode === n.id), emitted: {},
    };
  });
  const released = term.kind === "Complete";
  return { pipeline: "__imported__", scenario: "clean", agents, released, haltedAt: released ? null : term.node };
}
function readImported(): ImportedPayload | null {
  try {
    const raw = localStorage.getItem(IMPORTED_WORKFLOW);
    return raw ? (JSON.parse(raw) as ImportedPayload) : null;
  } catch {
    return null;
  }
}

/* ============================================================================
 * Top-down layered layout (Sugiyama-lite). Turns any DAG into the PwC-style
 * vertical process flow: roots at the top, one layer per longest-path depth,
 * knowledge bases sit as sidecars to the right of the layer they feed.
 * ========================================================================== */
const LAYER_H = 184;
const NODE_W = 250;
const GAP_X = 46;

function layeredLayout(
  ids: string[],
  flow: { from: string; to: string }[],
  ref: { from: string; to: string }[],
): { pos: Record<string, { x: number; y: number }>; roots: string[]; leaves: string[]; maxDepth: number } {
  const idset = new Set(ids);
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  const outdeg = new Map<string, number>();
  ids.forEach((id) => { adj.set(id, []); indeg.set(id, 0); outdeg.set(id, 0); });
  flow.forEach((e) => {
    if (!idset.has(e.from) || !idset.has(e.to)) return;
    adj.get(e.from)!.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    outdeg.set(e.from, (outdeg.get(e.from) ?? 0) + 1);
  });
  const depth = new Map<string, number>();
  ids.forEach((id) => depth.set(id, 0));
  const work = new Map(indeg);
  const queue = ids.filter((id) => (work.get(id) ?? 0) === 0);
  let guard = 0;
  const cap = ids.length * ids.length + 16;
  while (queue.length && guard++ < cap) {
    const u = queue.shift()!;
    for (const v of adj.get(u) ?? []) {
      depth.set(v, Math.max(depth.get(v) ?? 0, (depth.get(u) ?? 0) + 1));
      work.set(v, (work.get(v) ?? 1) - 1);
      if ((work.get(v) ?? 0) === 0) queue.push(v);
    }
  }
  // knowledge sidecars share their reference-target's depth, pushed to the right
  const sidecars = new Set<string>();
  ref.forEach((e) => {
    if (idset.has(e.from) && idset.has(e.to)) {
      depth.set(e.from, depth.get(e.to)!);
      sidecars.add(e.from);
    }
  });
  const layers = new Map<number, { main: string[]; side: string[] }>();
  ids.forEach((id) => {
    const d = depth.get(id) ?? 0;
    if (!layers.has(d)) layers.set(d, { main: [], side: [] });
    (sidecars.has(id) ? layers.get(d)!.side : layers.get(d)!.main).push(id);
  });
  const pos: Record<string, { x: number; y: number }> = {};
  let maxDepth = 0;
  [...layers.keys()].sort((a, b) => a - b).forEach((d) => {
    maxDepth = Math.max(maxDepth, d);
    const { main, side } = layers.get(d)!;
    const row = [...main, ...side];
    const total = row.length * NODE_W + (row.length - 1) * GAP_X;
    let x = -total / 2;
    row.forEach((id) => {
      pos[id] = { x, y: d * LAYER_H };
      x += NODE_W + GAP_X;
    });
  });
  const roots = ids.filter((id) => !sidecars.has(id) && (indeg.get(id) ?? 0) === 0);
  const leaves = ids.filter((id) => !sidecars.has(id) && (outdeg.get(id) ?? 0) === 0);
  return { pos, roots, leaves, maxDepth };
}

/* ============================================================================
 * Canvas node components (top-down: target=Top, source=Bottom)
 * ========================================================================== */
interface AgentNodeData extends Record<string, unknown> {
  agent: AgentRun;
  killed: boolean;
  isSelected: boolean;
  readOnly?: boolean;
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
  const { agent, killed, onTier, onKill, onSelect, readOnly } = data;
  const s = STATUS[agent.status];
  return (
    <div
      onClick={() => onSelect(agent.id)}
      className={`w-[250px] overflow-hidden rounded-xl border bg-panel shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition ${
        selected || data.isSelected ? "border-fg" : "border-edge hover:border-fg/40"
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Right} id="kb" className="!top-[34px]" />

      <div className={`flex items-center gap-2 border-b border-edge bg-panel2 px-3 py-2 border-t-2 ${s.accent}`}>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-fg/10 text-fg">
          <KindIcon kind="agent" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-fg">{agent.name}</span>
        {readOnly ? (
          <span className={`${chip} bg-ink text-muted`}>imported</span>
        ) : (
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
        )}
      </div>

      <div className="space-y-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${s.dot} ${agent.status === "ok" ? "animate-pulse" : ""}`} />
          <span className={`${chip} bg-ink ${s.text}`}>{s.label}</span>
        </div>
        <p className="line-clamp-2 text-[11px] leading-snug text-muted">{agent.role}</p>

        <div className="flex items-center justify-between gap-2 rounded-md bg-ink/60 px-2 py-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted">Governance</span>
          {readOnly ? <span className="text-[10px] text-muted">Tier {agent.tier} · read-only</span> : <GovernanceDial tier={agent.tier} disabled={killed} onPick={(t) => onTier(agent.id, t)} />}
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
      <Handle type="source" position={Position.Left} />
      <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-fg/10 text-fg">
          <KindIcon kind="knowledge" />
        </span>
        <span className="text-[12px] font-semibold text-fg">{data.label || "Knowledge base"}</span>
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

interface TerminalNodeData extends Record<string, unknown> {
  label: string;
  variant: "start" | "end";
  released?: boolean;
}
function TerminalNode({ data }: NodeProps<Node<TerminalNodeData>>) {
  const isStart = data.variant === "start";
  const tone = isStart ? "border-fg/40 text-fg" : data.released === false ? "border-warn/50 text-warn" : "border-ok/50 text-ok";
  return (
    <div className={`grid h-[52px] w-[150px] place-items-center rounded-full border bg-panel px-4 text-center shadow-[0_8px_30px_rgba(0,0,0,0.5)] ${tone}`}>
      {!isStart ? <Handle type="target" position={Position.Top} /> : null}
      {isStart ? <Handle type="source" position={Position.Bottom} /> : null}
      <div className="flex items-center gap-1.5">
        <KindIcon kind={data.variant} size={14} />
        <span className="text-[12px] font-semibold uppercase tracking-wide">{data.label}</span>
      </div>
    </div>
  );
}

/* ---- builder node (editable; used only in "Build your own" mode) ---- */
interface SnapNode {
  id: string;
  kind: NodeKind;
  label: string;
  tier: number;
  pos: { x: number; y: number };
}
interface BuildNodeData extends Record<string, unknown> {
  kind: NodeKind;
  label: string;
  tier: number;
  planned?: "governed" | "gate" | null;
  isSelected: boolean;
  onRename: (id: string, v: string) => void;
  onDelete: (id: string) => void;
  onTier: (id: string, t: number) => void;
  onSelect: (id: string) => void;
}
function BuildNode({ id, data, selected }: NodeProps<Node<BuildNodeData>>) {
  const cat = CATALOG_BY_KIND[data.kind];
  const terminal = data.kind === "start" || data.kind === "end";
  return (
    <div
      onClick={() => data.onSelect(id)}
      className={`w-[230px] overflow-hidden rounded-xl border bg-panel shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition ${
        selected || data.isSelected ? "border-fg" : "border-edge hover:border-fg/40"
      }`}
    >
      {data.kind !== "start" ? <Handle type="target" position={Position.Top} /> : null}
      {data.kind !== "end" ? <Handle type="source" position={Position.Bottom} /> : null}
      <div className="flex items-center gap-2 border-b border-edge bg-panel2 px-2.5 py-1.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-fg/10 text-fg">
          <KindIcon kind={data.kind} />
        </span>
        <input
          value={data.label}
          onChange={(e) => data.onRename(id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="nodrag min-w-0 flex-1 truncate rounded bg-transparent text-[12.5px] font-semibold text-fg outline-none focus:bg-ink/60"
        />
        <button
          onClick={(e) => { e.stopPropagation(); data.onDelete(id); }}
          className="nodrag text-[13px] leading-none text-muted hover:text-bad"
          title="Delete node"
        >
          ×
        </button>
      </div>
      {!terminal ? (
        <div className="space-y-1.5 px-2.5 py-2">
          <span className={`${chip} ${STRENGTH_CLS[cat.strength]}`}>{cat.strength === "none" ? "trace" : cat.strength}</span>
          <p className="text-[10.5px] leading-snug text-muted">{cat.binds}</p>
          {cat.tierable ? (
            <div className="flex items-center justify-between gap-2 rounded-md bg-ink/60 px-2 py-1">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-muted">Tier</span>
              <GovernanceDial tier={data.tier} disabled={false} onPick={(t) => data.onTier(id, t)} />
            </div>
          ) : null}
          {data.planned ? (
            <span className={`${chip} ${data.planned === "gate" ? "bg-link/15 text-link" : "bg-ok/15 text-ok"}`}>
              {data.planned === "gate" ? "⛨ gate planned" : "✓ governed"}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const runNodeTypes = { agent: AgentFlowNode, knowledge: KnowledgeNode, terminal: TerminalNode };
const buildNodeTypes = { build: BuildNode, terminal: TerminalNode };

/* ============================================================================
 * Page
 * ========================================================================== */
const BLANK_ID = "__blank__";

export default function OrchestratorPage() {
  return (
    <ReactFlowProvider>
      <OrchestratorInner />
    </ReactFlowProvider>
  );
}

function OrchestratorInner() {
  const [manifest, setManifest] = useState<PipelineManifest[] | null>(null);
  const [pipeline, setPipeline] = useState<string>("");
  const [tiers, setTiers] = useState<Record<string, number>>({});
  const [killed, setKilled] = useState<string[]>([]);
  const [scenario, setScenario] = useState("clean");
  const [result, setResult] = useState<OrchestrationResult | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [buildPlan, setBuildPlan] = useState<{ ok: boolean; issues: string[]; nodes: number } | null>(null);
  const [customResult, setCustomResult] = useState<OrchestrationResult | null>(null);
  const [buildSnapshot, setBuildSnapshot] = useState<SnapNode[] | null>(null);
  const [customEdges, setCustomEdges] = useState<{ from: string; to: string }[]>([]);
  const [customKilled, setCustomKilled] = useState<string[]>([]);
  const [customBusy, setCustomBusy] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition } = useReactFlow();
  const seq = useRef(0);

  const building = pipeline === BLANK_ID;
  const governed = building && customResult !== null; // viewing a real kernel run of the built graph
  const current = manifest?.find((p) => p.id === pipeline);

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      const res = await fetch("/api/orchestrate");
      const json = (await res.json()) as { pipelines: PipelineManifest[] };
      const imported = readImported();
      const blank: PipelineManifest = { id: BLANK_ID, label: "＋ Build your own", vertical: "custom workflow", scenarios: [{ id: "clean", label: "—" }], agents: [], nodes: [], edges: [] };
      const pipelines = [...json.pipelines, ...(imported ? [importedManifest(imported)] : []), blank];
      setManifest(pipelines);
      const initial = imported ? pipelines[pipelines.length - 2] : pipelines[0];
      if (initial) applyPipeline(initial);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTier = useCallback((id: string, t: number) => setTiers((p) => ({ ...p, [id]: t })), []);
  const onKill = useCallback((id: string) => setKilled((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])), []);
  const onSelect = useCallback((id: string) => setSelected(id), []);
  const onRename = useCallback((id: string, v: string) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: v } } : n))), [setNodes]);
  const onDelete = useCallback((id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
  }, [setNodes, setEdges]);
  const onBuildTier = useCallback((id: string, t: number) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, tier: t } } : n))), [setNodes]);

  const applyPipeline = (p: PipelineManifest) => {
    setPipeline(p.id);
    setTiers(Object.fromEntries(p.agents.map((a) => [a.id, a.defaultTier])));
    setKilled([]);
    setScenario("clean");
    setBuildPlan(null);
    setResult(null);
    setCustomResult(null);
    setBuildSnapshot(null);
    setCustomKilled([]);
    if (p.id === BLANK_ID) {
      // seed a blank canvas with just Start + End terminals
      seq.current = 0;
      setSelected("");
      setNodes([
        { id: "start", type: "terminal", position: { x: 0, y: 0 }, data: { label: "Start", variant: "start" } } as Node,
        { id: "end", type: "terminal", position: { x: 0, y: LAYER_H * 3 }, data: { label: "End", variant: "end" } } as Node,
      ]);
      setEdges([]);
    } else {
      setSelected(p.agents[Math.min(2, p.agents.length - 1)]?.id ?? "");
      setNodes([]);
      setEdges([]);
    }
  };

  const key = useMemo(
    () => JSON.stringify({ pipeline, tiers, killed: [...killed].sort(), scenario }),
    [pipeline, tiers, killed, scenario],
  );

  const run = useCallback(async () => {
    if (!pipeline || building) return;
    if (pipeline === "__imported__") {
      const p = readImported();
      if (p) setResult(synthesizeImported(p));
      return;
    }
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
  }, [key, building]);

  useEffect(() => {
    void run();
  }, [run]);

  // Sync canvas from the governed result (curated / imported pipelines only).
  // In build mode the canvas is user-owned, so bail out and leave it alone.
  useEffect(() => {
    if (building) return;
    if (!result || !current) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const flowPairs = current.edges.filter((e) => e.kind === "flow").map((e) => ({ from: e.from, to: e.to }));
    const refPairs = current.edges.filter((e) => e.kind === "reference").map((e) => ({ from: e.from, to: e.to }));
    const { pos, roots, leaves, maxDepth } = layeredLayout(current.nodes.map((n) => n.id), flowPairs, refPairs);
    const byId = Object.fromEntries(result.agents.map((a) => [a.id, a]));

    setNodes((prev) => {
      const flowNodes = current.nodes
        .map((n) => {
          const ex = prev.find((p) => p.id === n.id);
          const position = ex?.position ?? pos[n.id] ?? n.pos;
          if (n.kind === "knowledge") {
            return { id: n.id, type: "knowledge", position, data: { label: n.name, documents: n.documents ?? [] } } as Node;
          }
          const agent = byId[n.id];
          if (!agent) return null;
          return {
            id: n.id,
            type: "agent",
            position,
            data: { agent, killed: killed.includes(n.id), isSelected: n.id === selected, readOnly: pipeline === "__imported__", onTier, onKill, onSelect },
          } as Node;
        })
        .filter((n): n is Node => n !== null);
      // inject Start / End terminals top and bottom
      const startEx = prev.find((p) => p.id === "__start__");
      const endEx = prev.find((p) => p.id === "__end__");
      flowNodes.push(
        { id: "__start__", type: "terminal", position: startEx?.position ?? { x: 0, y: -LAYER_H }, data: { label: "Start", variant: "start" } } as Node,
        { id: "__end__", type: "terminal", position: endEx?.position ?? { x: 0, y: (maxDepth + 1) * LAYER_H }, data: { label: result.released ? "Released" : "Contained", variant: "end", released: result.released } } as Node,
      );
      return flowNodes;
    });

    const flowEdges: Edge[] = current.edges.map((e) => {
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
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 },
        label: passed && keys.length ? keys.join(" · ") : src && src.status !== "ok" ? "contained" : "",
        labelStyle: { fill: "#8a8a90", fontSize: 10 },
        labelBgStyle: { fill: "#0a0a0b" },
        style: { stroke, strokeWidth: 1.5, strokeDasharray: passed ? undefined : "4 3" },
      } as Edge;
    });
    roots.forEach((r) => flowEdges.push({ id: `__start__->${r}`, source: "__start__", target: r, markerEnd: { type: MarkerType.ArrowClosed, color: "#5a5a5e", width: 16, height: 16 }, style: { stroke: "#5a5a5e", strokeWidth: 1.5 } } as Edge));
    leaves.forEach((l) => {
      const passed = byId[l]?.status === "ok";
      flowEdges.push({ id: `${l}->__end__`, source: l, target: "__end__", animated: passed, markerEnd: { type: MarkerType.ArrowClosed, color: passed ? "#d6d6d8" : "#5a5a5e", width: 16, height: 16 }, style: { stroke: passed ? "#d6d6d8" : "#5a5a5e", strokeWidth: 1.5, strokeDasharray: passed ? undefined : "4 3" } } as Edge);
    });
    setEdges(flowEdges);
  }, [result, current, pipeline, selected, killed, building, onTier, onKill, onSelect, setNodes, setEdges]);

  // keep build-node data callbacks / selection fresh (editable build mode only)
  useEffect(() => {
    if (!building || customResult) return;
    setNodes((ns) => ns.map((n) => (n.type === "build" ? { ...n, data: { ...n.data, isSelected: n.id === selected, onRename, onDelete, onTier: onBuildTier, onSelect } } : n)));
  }, [building, customResult, selected, onRename, onDelete, onBuildTier, onSelect, setNodes]);

  /* ---- build-mode canvas interactions ---- */
  const onConnect = useCallback(
    (c: Connection) => setEdges((es) => addEdge({ ...c, markerEnd: { type: MarkerType.ArrowClosed, color: "#7a7a80", width: 16, height: 16 }, style: { stroke: "#7a7a80", strokeWidth: 1.5 } }, es)),
    [setEdges],
  );
  const onDragOver = useCallback((e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);
  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (!building || customResult) return;
      const kind = e.dataTransfer.getData("application/regent-node") as NodeKind;
      if (!kind || !CATALOG_BY_KIND[kind]) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const cat = CATALOG_BY_KIND[kind];
      if (kind === "start" || kind === "end") {
        const nid = kind;
        setNodes((ns) => (ns.some((n) => n.id === nid) ? ns : [...ns, { id: nid, type: "terminal", position, data: { label: cat.label, variant: kind } } as Node]));
        return;
      }
      const id = `n${++seq.current}`;
      setNodes((ns) => [
        ...ns,
        { id, type: "build", position, data: { kind, label: cat.label, tier: cat.tierable ? 3 : 0, planned: null, isSelected: false, onRename, onDelete, onTier: onBuildTier, onSelect } } as Node,
      ]);
      setBuildPlan(null);
    },
    [building, customResult, screenToFlowPosition, setNodes, onRename, onDelete, onBuildTier, onSelect],
  );

  // Compile the built graph to a governed Pipeline server-side and run it through
  // the REAL deterministic kernel (same machinery as the built-in pipelines).
  const postCustom = useCallback(async (snap: SnapNode[], srcEdges: { from: string; to: string }[], killedList: string[]) => {
    setCustomBusy(true);
    try {
      const graph = { id: "__custom__", label: "Custom workflow", nodes: snap.map(({ id, kind, label, tier }) => ({ id, kind, label, ...(tier ? { tier } : {}) })), edges: srcEdges };
      const res = await fetch("/api/orchestrate/custom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ graph, killed: killedList }) });
      const json = (await res.json()) as { ok: boolean; result?: OrchestrationResult };
      if (json.result) setCustomResult(json.result);
    } finally {
      setCustomBusy(false);
    }
  }, []);

  // "Govern ▶": structural check, then (if valid) snapshot + run through the kernel.
  const governBuild = useCallback(() => {
    const buildNodes = nodes.filter((n) => n.type === "build");
    const hasStart = nodes.some((n) => n.type === "terminal" && (n.data as TerminalNodeData).variant === "start");
    const hasEnd = nodes.some((n) => n.type === "terminal" && (n.data as TerminalNodeData).variant === "end");
    const targeted = new Set(edges.map((e) => e.target));
    const sourced = new Set(edges.map((e) => e.source));
    const issues: string[] = [];
    if (!hasStart) issues.push("No Start node — add a workflow entry point.");
    if (!hasEnd) issues.push("No End node — add a release/exit point.");
    buildNodes.forEach((n) => {
      const d = n.data as BuildNodeData;
      if (!targeted.has(n.id) && !sourced.has(n.id)) issues.push(`"${d.label}" is not connected.`);
    });
    if (issues.length) {
      setBuildPlan({ ok: false, issues, nodes: buildNodes.length });
      setCustomResult(null);
      return;
    }
    const snap: SnapNode[] = nodes
      .filter((n) => n.type === "build" || n.type === "terminal")
      .map((n) => {
        if (n.type === "terminal") { const d = n.data as TerminalNodeData; return { id: n.id, kind: d.variant, label: d.label, tier: 0, pos: n.position }; }
        const d = n.data as BuildNodeData; return { id: n.id, kind: d.kind, label: d.label, tier: d.tier, pos: n.position };
      });
    const srcEdges = edges.map((e) => ({ from: e.source, to: e.target }));
    setBuildPlan({ ok: true, issues: [], nodes: buildNodes.length });
    setBuildSnapshot(snap);
    setCustomEdges(srcEdges);
    setCustomKilled([]);
    void postCustom(snap, srcEdges, []);
  }, [nodes, edges, postCustom]);

  // Live governance on the built graph: change a node's tier or kill it → re-run.
  const rerunCustomTier = useCallback((id: string, t: number) => {
    setBuildSnapshot((snap) => {
      if (!snap) return snap;
      const next = snap.map((n) => (n.id === id ? { ...n, tier: t } : n));
      void postCustom(next, customEdges, customKilled);
      return next;
    });
  }, [postCustom, customEdges, customKilled]);
  const rerunCustomKill = useCallback((id: string) => {
    setCustomKilled((k) => {
      const next = k.includes(id) ? k.filter((x) => x !== id) : [...k, id];
      if (buildSnapshot) void postCustom(buildSnapshot, customEdges, next);
      return next;
    });
  }, [postCustom, buildSnapshot, customEdges]);

  // Return to editing: rebuild the editable canvas from the snapshot.
  const editBuild = useCallback(() => {
    const snap = buildSnapshot;
    setCustomResult(null);
    setBuildPlan(null);
    setCustomKilled([]);
    if (!snap) return;
    setNodes(snap.map((n) =>
      n.kind === "start" || n.kind === "end"
        ? ({ id: n.id, type: "terminal", position: n.pos, data: { label: n.label, variant: n.kind } } as Node)
        : ({ id: n.id, type: "build", position: n.pos, data: { kind: n.kind, label: n.label, tier: n.tier, planned: null, isSelected: false, onRename, onDelete, onTier: onBuildTier, onSelect } } as Node),
    ));
    setEdges(customEdges.map((e) => ({ id: `${e.from}->${e.to}`, source: e.from, target: e.to, markerEnd: { type: MarkerType.ArrowClosed, color: "#7a7a80", width: 16, height: 16 }, style: { stroke: "#7a7a80", strokeWidth: 1.5 } } as Edge)));
  }, [buildSnapshot, customEdges, onRename, onDelete, onBuildTier, onSelect, setNodes, setEdges]);

  // Render the governed run of the built graph — governed nodes at the placed
  // positions, statuses from the real kernel. Tier dial / kill re-run live.
  useEffect(() => {
    if (!governed || !buildSnapshot || !customResult) return;
    const byId = Object.fromEntries(customResult.agents.map((a) => [a.id, a]));
    const govNodes = buildSnapshot
      .map((n) => {
        if (n.kind === "start") return { id: n.id, type: "terminal", position: n.pos, data: { label: "Start", variant: "start" } } as Node;
        if (n.kind === "end") return { id: n.id, type: "terminal", position: n.pos, data: { label: customResult.released ? "Released" : "Contained", variant: "end", released: customResult.released } } as Node;
        if (n.kind === "knowledge") return { id: n.id, type: "knowledge", position: n.pos, data: { label: n.label, documents: ["Reference documents"] } } as Node;
        const agent = byId[n.id];
        if (!agent) return null;
        return { id: n.id, type: "agent", position: n.pos, data: { agent, killed: customKilled.includes(n.id), isSelected: n.id === selected, readOnly: false, onTier: rerunCustomTier, onKill: rerunCustomKill, onSelect } } as Node;
      })
      .filter((n): n is Node => n !== null);
    setNodes(govNodes);
    setEdges(
      customEdges.map((e) => {
        const src = byId[e.from];
        const passed = src?.status === "ok";
        const terminalEdge = !src; // edge out of the Start terminal
        const stroke = src ? STATUS[src.status].stroke : "#5a5a5e";
        return { id: `${e.from}->${e.to}`, source: e.from, target: e.to, animated: passed, markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 }, style: { stroke, strokeWidth: 1.5, strokeDasharray: passed || terminalEdge ? undefined : "4 3" } } as Edge;
      }),
    );
  }, [governed, buildSnapshot, customResult, customEdges, customKilled, selected, rerunCustomTier, rerunCustomKill, onSelect, setNodes, setEdges]);

  const reset = () => {
    if (current) applyPipeline(current);
  };

  const activeResult = governed ? customResult : result;
  const agents = activeResult?.agents ?? [];
  const sel = agents.find((a) => a.id === selected) ?? agents[0];
  const selBuild = building && !governed ? (nodes.find((n) => n.id === selected)?.data as BuildNodeData | undefined) : undefined;
  const editing = building && !governed;

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
        building={building}
        governed={governed}
        customBusy={customBusy}
        onGovern={governBuild}
        onEdit={editBuild}
      />

      <div className="flex min-h-0 flex-1 gap-3">
        <Palette building={editing} />

        <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-edge bg-ink" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={editing ? buildNodeTypes : runNodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={editing ? onEdgesChange : undefined}
            onConnect={editing ? onConnect : undefined}
            colorMode="dark"
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesConnectable={editing}
            edgesFocusable={editing}
            deleteKeyCode={editing ? ["Backspace", "Delete"] : null}
            proOptions={{ hideAttribution: true }}
            minZoom={0.35}
            maxZoom={1.6}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#23232a" />
            <Controls showInteractive={false} position="bottom-center" orientation="horizontal" />
          </ReactFlow>

          <div className="pointer-events-none absolute left-3 top-3 z-10">
            {editing ? <BuildPill plan={buildPlan} busy={customBusy} /> : <GlobalPill result={activeResult} />}
          </div>
          {editing && nodes.filter((n) => n.type === "build").length === 0 ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center text-[13px] text-muted">
              <div>
                <p className="text-fg">Drag node types from the library →</p>
                <p className="mt-1">connect them top-down, then <span className="text-fg">Govern ▶</span> to run through the kernel.</p>
              </div>
            </div>
          ) : null}
          {!building && agents.length === 0 ? (
            <div className="absolute inset-0 grid place-items-center text-[13px] text-muted">Initialising governed run…</div>
          ) : null}
        </div>

        {editing ? <BuildInspector sel={selBuild} plan={buildPlan} /> : <OutputPanel result={activeResult} sel={sel} />}
      </div>
    </div>
  );
}

/* ============================================================================
 * Left node-library palette
 * ========================================================================== */
function Palette({ building }: { building: boolean }) {
  const groups: CatalogEntry["group"][] = ["Flow", "Capability", "Governance"];
  const onDragStart = (e: DragEvent, kind: NodeKind) => {
    e.dataTransfer.setData("application/regent-node", kind);
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <div className="flex w-[210px] shrink-0 flex-col overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="border-b border-edge px-3 py-2.5">
        <h2 className="text-[12px] font-semibold text-fg">Node library</h2>
        <p className="mt-0.5 text-[10px] leading-snug text-muted">
          {building ? "Drag a node onto the canvas." : "Switch to “＋ Build your own” to compose."}
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2.5 py-3">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-1 px-1 text-[9px] font-semibold uppercase tracking-wider text-muted">{g}</p>
            <div className="space-y-1.5">
              {NODE_CATALOG.filter((c) => c.group === g).map((c) => (
                <div
                  key={c.kind}
                  draggable={building}
                  onDragStart={(e) => onDragStart(e, c.kind)}
                  title={c.blurb}
                  className={`group rounded-lg border border-edge bg-panel2 px-2 py-1.5 transition ${
                    building ? "cursor-grab hover:border-fg/40 active:cursor-grabbing" : "opacity-55"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-fg/10 text-fg">
                      <KindIcon kind={c.kind} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-fg">{c.label}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${c.strength === "deterministic" ? "bg-ok" : c.strength === "advisory" ? "bg-warn" : c.strength === "gate" ? "bg-link" : "bg-muted"}`} title={c.strength} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted">{c.blurb}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-edge px-3 py-2 text-[10px] leading-snug text-muted">
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-ok" /> deterministic</span>{" · "}
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warn" /> advisory</span>{" · "}
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-link" /> gate</span>
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
  building,
  governed,
  customBusy,
  onGovern,
  onEdit,
}: {
  manifest: PipelineManifest[] | null;
  current?: PipelineManifest;
  onPipeline: (id: string) => void;
  scenario: string;
  setScenario: (s: string) => void;
  reset: () => void;
  busy: boolean;
  building: boolean;
  governed: boolean;
  customBusy: boolean;
  onGovern: () => void;
  onEdit: () => void;
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
        <span className="ml-1 text-[11px] text-muted">{building ? (governed ? (customBusy ? "· re-running…" : "· governed run") : "· build mode") : busy ? "· re-running…" : "· governed"}</span>
      </div>
      <div className="flex items-center gap-2">
        {building && governed ? (
          <button onClick={onEdit} className="rounded-lg border border-edge px-3 py-1.5 text-[12px] font-semibold text-fg hover:border-fg/40" title="Return to editing the workflow">
            ✎ Edit
          </button>
        ) : building ? (
          <button onClick={onGovern} disabled={customBusy} className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-ink hover:opacity-90 disabled:opacity-50" title="Compile the built workflow and run it through the kernel">
            {customBusy ? "Running…" : "Govern ▶"}
          </button>
        ) : (
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
        )}
        <button onClick={reset} className="grid h-8 w-8 place-items-center rounded-lg border border-edge text-muted hover:text-fg" title={building ? "Clear canvas" : "Reset governance"}>
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

function BuildPill({ plan, busy }: { plan: { ok: boolean; issues: string[]; nodes: number } | null; busy: boolean }) {
  if (busy) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-fg/30 bg-panel/80 px-3 py-1.5 backdrop-blur">
        <span className={`${chip} bg-fg/15 text-fg`}>RUNNING</span>
        <span className="text-[11px] text-fg">Compiling the graph and running it through the kernel…</span>
      </div>
    );
  }
  if (!plan) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-edge bg-panel/80 px-3 py-1.5 backdrop-blur">
        <span className={`${chip} bg-ink text-muted`}>DRAFT</span>
        <span className="text-[11px] text-fg">Compose a workflow — then Govern ▶.</span>
      </div>
    );
  }
  if (plan.ok) return null; // valid → the governed run replaces this with the global pill
  return (
    <div className="flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-1.5 backdrop-blur">
      <span className={`${chip} bg-warn/20 text-warn`}>{`${plan.issues.length} ISSUE${plan.issues.length > 1 ? "S" : ""}`}</span>
      <span className="text-[11px] text-fg">Resolve issues in the plan →</span>
    </div>
  );
}

function BuildInspector({ sel, plan }: { sel: BuildNodeData | undefined; plan: { ok: boolean; issues: string[]; nodes: number } | null }) {
  return (
    <div className="flex w-[360px] shrink-0 flex-col overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
        <h2 className="text-[12px] font-semibold text-fg">Governance plan</h2>
        <span className="text-[10px] text-muted">deterministic · LLM-free</span>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {sel ? (
          <div className="rounded-lg border border-edge bg-panel2 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-fg/10 text-fg"><KindIcon kind={sel.kind} /></span>
              <span className="text-[12.5px] font-semibold text-fg">{sel.label}</span>
              <span className={`${chip} ${STRENGTH_CLS[CATALOG_BY_KIND[sel.kind].strength]}`}>{CATALOG_BY_KIND[sel.kind].strength}</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-muted">{CATALOG_BY_KIND[sel.kind].blurb}</p>
            <p className="mt-1.5 text-[11px] leading-snug text-fg">Binds: <span className="text-muted">{CATALOG_BY_KIND[sel.kind].binds}</span></p>
            {CATALOG_BY_KIND[sel.kind].tierable ? <p className="mt-1 text-[11px] text-muted">Enforcement intensity: <span className="text-fg">Tier {sel.tier}</span></p> : null}
          </div>
        ) : (
          <p className="text-[12px] text-muted">Select a node to see the controls Regent binds to it.</p>
        )}

        {plan ? (
          <div className="space-y-2 border-t border-edge pt-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Structural check</h3>
            {plan.ok ? (
              <p className="text-[11.5px] text-ok">✓ Valid topology — {plan.nodes} governed nodes, all connected, terminals present.</p>
            ) : (
              <ul className="space-y-1">
                {plan.issues.map((iss, i) => (
                  <li key={i} className="flex gap-2 text-[11.5px] text-warn">
                    <span>▸</span>
                    <span className="leading-snug">{iss}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] leading-snug text-muted">
              <span className="text-fg">Govern ▶</span> compiles this graph to a governed pipeline and runs it through the same deterministic kernel as the built-in workflows — each node&rsquo;s intent decides which constraints bind.
            </p>
          </div>
        ) : null}
      </div>
      <div className="border-t border-edge px-4 py-2.5 text-[11px] text-muted">
        Drag from the library, connect top-down, set each agent&rsquo;s tier, then Govern ▶.
      </div>
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
