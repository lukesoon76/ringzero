"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bars, CHART_COLORS as C, Donut, HBars, LineChart } from "../components/charts";

type AgentStatus = "ok" | "contained" | "blocked" | "killed" | "skipped";
interface AgentRun {
  id: string;
  name: string;
  status: AgentStatus;
  steps: { guardEvaluations: { guard: string; fired: boolean }[] }[];
}
interface RunResult {
  pipeline: string;
  scenario: string;
  agents: AgentRun[];
  released: boolean;
}
interface Manifest {
  id: string;
  label: string;
  scenarios: { id: string; label: string }[];
  agents: { id: string }[];
}
interface DeckItem {
  pipeline: string;
  label: string;
  attack: boolean;
  result: RunResult;
}

const HIST = 44;
const zeros = () => Array(HIST).fill(0) as number[];

export default function DashboardPage() {
  const [deck, setDeck] = useState<DeckItem[]>([]);
  const [running, setRunning] = useState(true);
  const [m, setM] = useState({ runs: 0, agents: 0, guardEvals: 0, guardsFired: 0, escalations: 0, blocks: 0, releases: 0, attacks: 0 });
  const [relHist, setRelHist] = useState<number[]>(zeros());
  const [escHist, setEscHist] = useState<number[]>(zeros());
  const [thru, setThru] = useState<number[]>(zeros());
  const [outcomes, setOutcomes] = useState<Record<AgentStatus, number>>({ ok: 0, contained: 0, blocked: 0, killed: 0, skipped: 0 });
  const [guards, setGuards] = useState<Record<string, number>>({});
  const [byPipeline, setByPipeline] = useState<Record<string, { label: string; runs: number; releases: number }>>({});

  const mRef = useRef(m);
  mRef.current = m;

  useEffect(() => {
    void (async () => {
      const man = (await (await fetch("/api/orchestrate")).json()) as { pipelines: Manifest[] };
      const post = async (pipeline: string, scenario: string) =>
        (await (await fetch("/api/orchestrate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pipeline, scenario }) })).json()) as { result: RunResult };
      const items: DeckItem[] = [];
      for (const p of man.pipelines) {
        for (const s of p.scenarios) {
          const { result } = await post(p.id, s.id);
          const copies = s.id === "clean" ? 3 : 1;
          for (let i = 0; i < copies; i++) items.push({ pipeline: p.id, label: p.label, attack: s.id !== "clean", result });
        }
      }
      setDeck(items);
    })();
  }, []);

  useEffect(() => {
    if (!running || deck.length === 0) return;
    const id = setInterval(() => {
      const item = deck[Math.floor(Math.random() * deck.length)]!;
      const r = item.result;
      let evals = 0;
      let fired = 0;
      let esc = 0;
      let blk = 0;
      const oc: Record<AgentStatus, number> = { ok: 0, contained: 0, blocked: 0, killed: 0, skipped: 0 };
      const gc: Record<string, number> = {};
      for (const a of r.agents) {
        oc[a.status]++;
        if (a.status === "contained") esc++;
        if (a.status === "blocked" || a.status === "killed") blk++;
        for (const st of a.steps) {
          for (const g of st.guardEvaluations) {
            evals++;
            if (g.fired) {
              fired++;
              gc[g.guard] = (gc[g.guard] ?? 0) + 1;
            }
          }
        }
      }
      const agentsStepped = r.agents.filter((a) => a.status !== "skipped").length;

      setM((p) => {
        const runs = p.runs + 1;
        const releases = p.releases + (r.released ? 1 : 0);
        const next = {
          runs,
          agents: p.agents + agentsStepped,
          guardEvals: p.guardEvals + evals,
          guardsFired: p.guardsFired + fired,
          escalations: p.escalations + esc,
          blocks: p.blocks + blk,
          releases,
          attacks: p.attacks + (item.attack && !r.released ? 1 : 0),
        };
        setRelHist((h) => [...h.slice(1), Math.round((releases / runs) * 100)]);
        setEscHist((h) => [...h.slice(1), Math.round((next.escalations / Math.max(1, next.agents)) * 100)]);
        return next;
      });
      setThru((h) => [...h.slice(1), evals]);
      setOutcomes((p) => ({ ok: p.ok + oc.ok, contained: p.contained + oc.contained, blocked: p.blocked + oc.blocked, killed: p.killed + oc.killed, skipped: p.skipped + oc.skipped }));
      setGuards((p) => {
        const n = { ...p };
        for (const [k, v] of Object.entries(gc)) n[k] = (n[k] ?? 0) + v;
        return n;
      });
      setByPipeline((p) => {
        const cur = p[item.pipeline] ?? { label: item.label, runs: 0, releases: 0 };
        return { ...p, [item.pipeline]: { label: item.label, runs: cur.runs + 1, releases: cur.releases + (r.released ? 1 : 0) } };
      });
    }, 1100);
    return () => clearInterval(id);
  }, [running, deck]);

  const releaseRate = m.runs ? Math.round((m.releases / m.runs) * 100) : 0;
  const topGuards = Object.entries(guards)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));
  const pipelines = Object.values(byPipeline);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-fg">
            Operations Dashboard
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full rounded-full ${running ? "animate-ping bg-ok/60" : "bg-muted"}`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${running ? "bg-ok" : "bg-muted"}`} />
            </span>
            <span className="text-[11px] font-normal text-muted">{running ? "LIVE" : "PAUSED"}</span>
          </h1>
          <p className="text-[13px] text-muted">Runtime governance operational statistics across all workflows — trends and distributions over time (simulated from real governed runs).</p>
        </div>
        <button onClick={() => setRunning((r) => !r)} className="h-7 rounded-lg border border-edge px-3 text-[12px] text-muted hover:text-fg">
          {running ? "Pause" : "Resume"}
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Runs governed" value={m.runs} />
        <Kpi label="Agents stepped" value={m.agents} />
        <Kpi label="Guard evaluations" value={m.guardEvals} />
        <Kpi label="Escalations" value={m.escalations} tone="warn" />
        <Kpi label="Attacks contained" value={m.attacks} tone="bad" />
        <Kpi label="Release rate" value={`${releaseRate}%`} tone="ok" />
      </div>

      {/* trends */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Release rate & escalation rate — trend over time">
          <LineChart
            series={[
              { label: "release rate", color: C.ok, points: relHist },
              { label: "escalation rate", color: C.warn, points: escHist },
            ]}
            max={100}
            suffix="%"
          />
          <Legend items={[{ label: "release %", color: C.ok }, { label: "escalation %", color: C.warn }]} />
        </Panel>
        <Panel title="Throughput — guard evaluations / interval">
          <Bars values={thru} height={120} color={C.fg} />
          <p className="mt-2 text-[11px] text-muted">guards fired {m.guardsFired} · blocks {m.blocks}</p>
        </Panel>
      </div>

      {/* distributions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Agent governance outcomes">
          <div className="flex items-center gap-4">
            <Donut
              segments={[
                { label: "pass", value: outcomes.ok, color: C.ok },
                { label: "contained", value: outcomes.contained, color: C.warn },
                { label: "blocked/killed", value: outcomes.blocked + outcomes.killed, color: C.bad },
                { label: "not reached", value: outcomes.skipped, color: C.edge },
              ]}
            />
            <div className="space-y-1 text-[11px]">
              <Legend vertical items={[
                { label: `pass · ${outcomes.ok}`, color: C.ok },
                { label: `contained · ${outcomes.contained}`, color: C.warn },
                { label: `blocked/killed · ${outcomes.blocked + outcomes.killed}`, color: C.bad },
                { label: `not reached · ${outcomes.skipped}`, color: C.edge },
              ]} />
            </div>
          </div>
        </Panel>
        <Panel title="Most-tripped guards">
          {topGuards.length ? <HBars items={topGuards} color={C.warn} /> : <p className="text-[12px] text-muted">no guards fired yet</p>}
        </Panel>
        <Panel title="By workflow">
          <div className="space-y-2">
            {pipelines.length === 0 ? (
              <p className="text-[12px] text-muted">priming…</p>
            ) : (
              pipelines.map((p) => {
                const rate = p.runs ? Math.round((p.releases / p.runs) * 100) : 0;
                return (
                  <div key={p.label}>
                    <div className="mb-0.5 flex items-center justify-between text-[11px]">
                      <span className="truncate text-fg">{p.label}</span>
                      <span className="text-muted">{p.runs} runs · {rate}%</span>
                    </div>
                    <div className="h-2 rounded-sm bg-ink">
                      <div className="h-2 rounded-sm" style={{ width: `${rate}%`, background: C.ok }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-fg";
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-edge bg-panel p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Legend({ items, vertical }: { items: { label: string; color: string }[]; vertical?: boolean }) {
  return (
    <div className={`mt-2 flex ${vertical ? "flex-col gap-1" : "flex-wrap gap-3"}`}>
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-2 w-2 rounded-sm" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
