"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ---- shapes from @ring-zero/policy orchestration ---- */
type AgentStatus = "ok" | "contained" | "blocked" | "killed" | "skipped";
interface AgentRun {
  id: string;
  name: string;
  tier: number;
  status: AgentStatus;
  terminalKind: string;
  rationale: string;
  cot: string[];
  theta: { alignment: number; confidence: number; containment: string };
  steps: { guardEvaluations: { guard: string; fired: boolean }[]; outcome: string; verifyResult?: { detail: string } }[];
}
interface RunResult {
  pipeline: string;
  scenario: string;
  agents: AgentRun[];
  released: boolean;
  haltedAt: string | null;
}
interface Manifest {
  id: string;
  label: string;
  vertical: string;
  scenarios: { id: string; label: string }[];
  agents: { id: string; name: string; defaultTier: number }[];
}
interface DeckItem {
  pipeline: string;
  vertical: string;
  scenario: string;
  attack: boolean;
  result: RunResult;
}

const STATUS: Record<AgentStatus, { dot: string; text: string }> = {
  ok: { dot: "bg-ok", text: "text-ok" },
  contained: { dot: "bg-warn", text: "text-warn" },
  blocked: { dot: "bg-bad", text: "text-bad" },
  killed: { dot: "bg-bad", text: "text-bad" },
  skipped: { dot: "bg-muted", text: "text-muted" },
};
const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";

interface FeedEvent {
  seq: number;
  t: string;
  kind: "start" | "think" | "decide" | "done";
  text: string;
  tone: "fg" | "ok" | "warn" | "bad" | "muted";
}
interface Metrics {
  runs: number;
  agents: number;
  guardEvals: number;
  guardsFired: number;
  escalations: number;
  blocks: number;
  releases: number;
  attacksContained: number;
}
const ZERO: Metrics = { runs: 0, agents: 0, guardEvals: 0, guardsFired: 0, escalations: 0, blocks: 0, releases: 0, attacksContained: 0 };
const TONE: Record<FeedEvent["tone"], string> = { fg: "text-fg", ok: "text-ok", warn: "text-warn", bad: "text-bad", muted: "text-muted" };

type Active = { item: DeckItem; idx: number; phase: "think" | "decide" };

export default function MonitoringPage() {
  const [deck, setDeck] = useState<DeckItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(ZERO);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [volume, setVolume] = useState<number[]>(Array(36).fill(0));
  const [active, setActive] = useState<Active | null>(null);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [uptime, setUptime] = useState(0);

  const seqRef = useRef(0);
  const clockRef = useRef(0);
  const tickEvents = useRef(0);

  // load manifest + build a deck of real governed runs to "play back" live.
  useEffect(() => {
    void (async () => {
      const m = (await (await fetch("/api/orchestrate")).json()) as { pipelines: Manifest[] };
      const post = async (pipeline: string, scenario: string, tiers?: Record<string, number>) =>
        (await (
          await fetch("/api/orchestrate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ pipeline, scenario, tiers }),
          })
        ).json()) as { result: RunResult };

      const items: DeckItem[] = [];
      for (const p of m.pipelines) {
        for (const s of p.scenarios) {
          const { result } = await post(p.id, s.id);
          const copies = s.id === "clean" ? 3 : 1; // healthy runs dominate the feed
          for (let i = 0; i < copies; i++)
            items.push({ pipeline: p.label, vertical: p.vertical, scenario: s.label, attack: s.id !== "clean", result });
        }
        const tail = p.agents[p.agents.length - 1];
        if (tail) {
          const { result } = await post(p.id, "clean", { [tail.id]: 4 });
          items.push({ pipeline: p.label, vertical: p.vertical, scenario: `${tail.name} raised to Tier 4`, attack: false, result });
        }
      }
      setDeck(items);
    })();
  }, []);

  const activeRef = useRef<Active | null>(null);

  // pure tick: compute next active state + events + metric deltas from a ref,
  // then dispatch all side effects at the top level (no side effects inside
  // state updaters → StrictMode-safe, no duplicate keys).
  const tick = useCallback(() => {
    if (deck.length === 0) return;
    const cur = activeRef.current;
    const events: Omit<FeedEvent, "seq" | "t">[] = [];
    let next: Active | null = cur;
    let agentStepped = false;
    let dEvals = 0;
    let dFired = 0;
    let dEsc = 0;
    let dBlk = 0;
    let finished: DeckItem | null = null;

    if (!cur) {
      const item = deck[Math.floor(Math.random() * deck.length)]!;
      events.push({ kind: "start", tone: "muted", text: `▶ new run · ${item.pipeline} · ${item.scenario}` });
      next = { item, idx: 0, phase: "think" };
    } else {
      const agent = cur.item.result.agents[cur.idx];
      const len = cur.item.result.agents.length;
      if (!agent) {
        next = cur;
      } else if (cur.phase === "think") {
        if (agent.status === "skipped") {
          events.push({ kind: "done", tone: "muted", text: `${agent.name} — not reached (fail-closed)` });
          const ni = cur.idx + 1;
          if (ni >= len) {
            finished = cur.item;
            next = null;
          } else next = { item: cur.item, idx: ni, phase: "think" };
        } else {
          events.push({ kind: "think", tone: "fg", text: `${agent.name} · Tier ${agent.tier} — ${agent.cot[0] ?? "reasoning…"}` });
          next = { ...cur, phase: "decide" };
        }
      } else {
        // decide — emit the real governed outcome
        agentStepped = true;
        dEvals = agent.steps.reduce((n, st) => n + st.guardEvaluations.length, 0);
        dFired = agent.steps.flatMap((st) => st.guardEvaluations).filter((g) => g.fired).length;
        dEsc = agent.status === "contained" ? 1 : 0;
        dBlk = agent.status === "blocked" || agent.status === "killed" ? 1 : 0;
        const tone = agent.status === "ok" ? "ok" : agent.status === "contained" ? "warn" : "bad";
        events.push({ kind: "decide", tone, text: `${agent.name} → ${agent.terminalKind} · ${agent.rationale}` });
        const ni = cur.idx + 1;
        if (agent.status !== "ok" || ni >= len) {
          finished = cur.item;
          next = null;
        } else next = { item: cur.item, idx: ni, phase: "think" };
      }
    }

    if (finished) {
      const r = finished.result;
      events.push({ kind: "done", tone: r.released ? "ok" : "warn", text: r.released ? "■ run complete · RELEASED" : `■ run contained at ${r.haltedAt} · no release` });
    }

    // dispatch state (all at top level; updaters stay pure)
    activeRef.current = next;
    setActive(next);
    const fin = finished;
    if (agentStepped || fin) {
      setMetrics((m) => ({
        runs: m.runs + (fin ? 1 : 0),
        agents: m.agents + (agentStepped ? 1 : 0),
        guardEvals: m.guardEvals + dEvals,
        guardsFired: m.guardsFired + dFired,
        escalations: m.escalations + dEsc,
        blocks: m.blocks + dBlk,
        releases: m.releases + (fin && fin.result.released ? 1 : 0),
        attacksContained: m.attacksContained + (fin && fin.attack && !fin.result.released ? 1 : 0),
      }));
    }
    // stamp seq/clock OUTSIDE the updater so the setFeed reducer stays pure.
    const stamped: FeedEvent[] = events.map((e) => {
      seqRef.current += 1;
      clockRef.current += 1;
      const secs = clockRef.current;
      return { ...e, seq: seqRef.current, t: `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}` };
    });
    tickEvents.current = stamped.length;
    if (stamped.length) setFeed((f) => [...stamped.reverse(), ...f].slice(0, 40));
  }, [deck]);

  // drive the tick loop + rolling volume + uptime.
  useEffect(() => {
    if (!running || deck.length === 0) return;
    const interval = 950 / speed;
    const id = setInterval(() => {
      tick();
      setVolume((v) => [...v.slice(1), tickEvents.current]);
      setUptime((u) => u + 1);
    }, interval);
    return () => clearInterval(id);
  }, [running, speed, deck, tick]);

  const releaseRate = metrics.runs ? Math.round((metrics.releases / metrics.runs) * 100) : 0;
  const activeAgents = active?.item.result.agents ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-fg">
            Live Governance Monitor
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full rounded-full ${running ? "animate-ping bg-ok/60" : "bg-muted"}`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${running ? "bg-ok" : "bg-muted"}`} />
            </span>
            <span className="text-[11px] font-normal text-muted">{running ? "LIVE" : "PAUSED"}</span>
          </h1>
          <p className="max-w-3xl text-[13px] text-muted">
            Runtime governance, streaming. Every event below is a real kernel decision from a governed run — agents
            thinking and being governed live, deterministically and fail-closed.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-muted">uptime {fmtUptime(uptime)}</span>
          {[1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`h-7 w-9 rounded-lg border text-[11px] ${speed === s ? "border-fg/40 bg-fg/10 text-fg" : "border-edge text-muted hover:text-fg"}`}
            >
              {s}×
            </button>
          ))}
          <button onClick={() => setRunning((r) => !r)} className="h-7 rounded-lg border border-edge px-3 text-muted hover:text-fg">
            {running ? "Pause" : "Resume"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Runs governed" value={metrics.runs} />
        <Kpi label="Agents stepped" value={metrics.agents} />
        <Kpi label="Guard evaluations" value={metrics.guardEvals} />
        <Kpi label="Escalations" value={metrics.escalations} tone="warn" />
        <Kpi label="Attacks contained" value={metrics.attacksContained} tone="bad" />
        <Kpi label="Release rate" value={`${releaseRate}%`} tone="ok" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="rounded-xl border border-edge bg-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Agents working now</h2>
            {active ? <span className="truncate text-[11px] text-muted">{active.item.pipeline} · {active.item.scenario}</span> : null}
          </div>
          {activeAgents.length === 0 ? (
            <p className="text-[13px] text-muted">{deck.length === 0 ? "Priming governed runs…" : "Waiting for next run…"}</p>
          ) : (
            <ol className="space-y-2">
              {activeAgents.map((a, i) => {
                const done = active ? i < active.idx : false;
                const isActive = active ? i === active.idx : false;
                const s = STATUS[a.status];
                return (
                  <li
                    key={a.id}
                    className={`rounded-lg border p-2.5 transition ${isActive ? "border-fg/40 bg-panel2" : "border-edge"} ${!done && !isActive ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${isActive ? "animate-pulse bg-fg" : done ? s.dot : "bg-edge"}`} />
                      <span className="text-[12.5px] font-semibold text-fg">{a.name}</span>
                      <span className={`${chip} bg-ink text-muted`}>Tier {a.tier}</span>
                      {done ? <span className={`${chip} bg-ink ${s.text}`}>{a.terminalKind}</span> : null}
                      {isActive ? <span className="ml-auto text-[11px] text-fg">analysing<Dots /></span> : null}
                    </div>
                    {isActive ? (
                      <div className="mt-1.5 space-y-1">
                        <p className="text-[11px] text-muted">
                          <span className="text-fg">thinking:</span> {a.cot.join(" → ")}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {a.steps.flatMap((st) => st.guardEvaluations).slice(0, 6).map((g, j) => (
                            <span key={j} className={`${chip} ${g.fired ? "bg-warn/15 text-warn" : "bg-ink text-muted"}`}>
                              {g.guard}
                              {g.fired ? " ◂" : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : done ? (
                      <p className="mt-1 line-clamp-1 text-[11px] text-muted">{a.rationale}</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-edge bg-panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Governance event volume</h2>
              <span className="text-[11px] text-muted">guards fired {metrics.guardsFired} · blocks {metrics.blocks}</span>
            </div>
            <Bars values={volume} />
          </div>

          <div className="rounded-xl border border-edge bg-panel p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Live event feed</h2>
            <div className="h-[300px] space-y-1 overflow-hidden font-mono text-[11px]">
              {feed.map((e) => (
                <div key={e.seq} className="flex gap-2">
                  <span className="text-muted">{e.t}</span>
                  <span className={`${TONE[e.tone]} min-w-0 flex-1 truncate`}>{e.text}</span>
                </div>
              ))}
              {feed.length === 0 ? <div className="text-muted">awaiting governed events…</div> : null}
            </div>
          </div>
        </div>
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

function Bars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-16 items-end gap-[3px]">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-fg/25"
          style={{ height: `${Math.max(4, (v / max) * 100)}%`, opacity: 0.3 + (i / values.length) * 0.7 }}
        />
      ))}
    </div>
  );
}

function Dots() {
  return <span className="inline-block w-3 animate-pulse">…</span>;
}

function fmtUptime(ticks: number) {
  return `${String(Math.floor(ticks / 60)).padStart(2, "0")}:${String(ticks % 60).padStart(2, "0")}`;
}
