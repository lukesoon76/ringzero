"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePermissions } from "../../components/PermissionsProvider";

/* ---- types mirroring @ring-zero/policy orchestration output ---- */
interface GuardEval { guard: string; fired: boolean; score?: number; threshold?: number; advisory: boolean }
interface Step { index: number; action: { id: string; intent: string; kind: string }; decision: string; outcome: string; guardEvaluations: GuardEval[]; verifyResult?: { verified: number; detail: string } }
type AgentStatus = "ok" | "contained" | "blocked" | "killed" | "skipped";
interface AgentRun {
  id: string; name: string; role: string; tier: number; status: AgentStatus; terminalKind: string; rationale: string;
  cot: string[]; governanceNote: string;
  theta: { alignment: number; confidence: number; containment: string; dualApproval: boolean; lengthBudget: number };
  steps: Step[];
}
interface OrchestrationResult { pipeline: string; scenario: string; agents: AgentRun[]; released: boolean; haltedAt: string | null }
interface Manifest { id: string; label: string; vertical: string; scenarios: { id: string; label: string }[] }

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";
const STATUS: Record<AgentStatus, { label: string; cls: string }> = {
  ok: { label: "PASS", cls: "bg-ok/15 text-ok" },
  contained: { label: "CONTAINED", cls: "bg-warn/15 text-warn" },
  blocked: { label: "BLOCKED", cls: "bg-bad/15 text-bad" },
  killed: { label: "KILLED", cls: "bg-bad/15 text-bad" },
  skipped: { label: "NOT REACHED", cls: "bg-ink text-muted" },
};

/* a flat, time-ordered stream of cognition events */
type Ev =
  | { t: "agent"; a: AgentRun }
  | { t: "thought"; a: AgentRun; line: string }
  | { t: "binding"; a: AgentRun; step: Step }
  | { t: "terminal"; a: AgentRun };

function buildStream(agents: AgentRun[]): Ev[] {
  const evs: Ev[] = [];
  for (const a of agents) {
    if (a.status === "skipped" || a.status === "killed") { evs.push({ t: "agent", a }, { t: "terminal", a }); continue; }
    evs.push({ t: "agent", a });
    for (const line of a.cot) evs.push({ t: "thought", a, line });
    for (const step of a.steps) evs.push({ t: "binding", a, step });
    evs.push({ t: "terminal", a });
  }
  return evs;
}

export default function CognitionPage() {
  const canKill = !!usePermissions()?.has("agent:kill");
  const [manifest, setManifest] = useState<Manifest[]>([]);
  const [pipeline, setPipeline] = useState("");
  const [scenario, setScenario] = useState("clean");
  const [result, setResult] = useState<OrchestrationResult | null>(null);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [killed, setKilled] = useState<{ agent: string; contained: string[] } | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      const json = (await (await fetch("/api/orchestrate")).json()) as { pipelines: Manifest[] };
      setManifest(json.pipelines.filter((p) => p.id !== "__blank__" && p.id !== "__imported__"));
      const first = json.pipelines[0];
      if (first) { setPipeline(first.id); setScenario(first.scenarios[0]?.id ?? "clean"); }
    })();
  }, []);

  const current = manifest.find((m) => m.id === pipeline);
  const events = useMemo(() => (result ? buildStream(result.agents) : []), [result]);

  const start = useCallback(async () => {
    setPlaying(false); setShown(0); setKilled(null); setResult(null);
    const res = await fetch("/api/orchestrate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pipeline, scenario }) });
    const json = (await res.json()) as { result?: OrchestrationResult };
    if (json.result) { setResult(json.result); setShown(0); setPlaying(true); }
  }, [pipeline, scenario]);

  // reveal one event at a time while playing
  useEffect(() => {
    if (!playing || killed || shown >= events.length) { if (shown >= events.length && events.length) setPlaying(false); return; }
    const isThought = events[shown]?.t === "thought";
    const delay = (isThought ? 420 : 620) / speed;
    const id = setTimeout(() => setShown((s) => s + 1), delay);
    return () => clearTimeout(id);
  }, [playing, shown, events, speed, killed]);

  useEffect(() => { feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" }); }, [shown]);

  // the agent whose cognition is currently on screen
  const currentAgent = shown > 0 ? events[shown - 1]?.a : undefined;

  async function killNow() {
    if (!currentAgent) return;
    setPlaying(false);
    const res = await fetch("/api/orchestrate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pipeline, scenario, killed: [currentAgent.id] }) });
    const json = (await res.json()) as { result?: OrchestrationResult };
    const contained = json.result ? json.result.agents.filter((a) => a.status === "skipped").map((a) => a.name) : [];
    setKilled({ agent: currentAgent.name, contained });
  }

  const visible = events.slice(0, shown);
  const running = playing || (result !== null && shown < events.length && !killed);

  return (
    <div className="flex h-[calc(100vh-150px)] flex-col gap-3">
      <div>
        <h1 className="text-lg font-semibold text-fg">Cognition Stream</h1>
        <p className="max-w-4xl text-[13px] text-muted">
          Other platforms stop at input and output. This dissects the agents&rsquo; <span className="text-fg">reasoning
          trajectory</span> as it runs — and shows, alongside each step, the <span className="text-fg">deterministic guard</span>
          {" "}evaluating it. The chain-of-thought is <span className="text-warn">advisory</span> (never on the binding path);
          the guard is what <span className="text-ok">binds</span>. Hit <span className="text-bad">KILL</span> mid-thought and the
          kernel contains everything downstream, fail-closed.
        </p>
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-edge bg-panel px-3 py-2">
        <select value={pipeline} onChange={(e) => { setPipeline(e.target.value); const p = manifest.find((m) => m.id === e.target.value); setScenario(p?.scenarios[0]?.id ?? "clean"); setResult(null); setShown(0); setKilled(null); }} className="rounded-lg border border-edge bg-ink px-2 py-1.5 text-[13px] font-semibold text-fg">
          {manifest.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select value={scenario} onChange={(e) => { setScenario(e.target.value); setResult(null); setShown(0); setKilled(null); }} className="rounded-lg border border-edge bg-ink px-2 py-1.5 text-[12px] text-fg">
          {(current?.scenarios ?? []).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button onClick={() => void start()} className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-ink hover:opacity-90">{result ? "↻ Replay" : "▶ Run cognition"}</button>
        {running && !playing ? <button onClick={() => setPlaying(true)} className="rounded-lg border border-edge px-3 py-1.5 text-[12px] text-fg">Resume</button> : null}
        {playing ? <button onClick={() => setPlaying(false)} className="rounded-lg border border-edge px-3 py-1.5 text-[12px] text-fg">Pause</button> : null}
        <label className="flex items-center gap-1.5 text-[11px] text-muted">speed<input type="range" min={0.5} max={4} step={0.5} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-24 accent-white" /><span className="w-6 text-fg">{speed}×</span></label>
        <div className="ml-auto">
          {killed ? (
            <span className={`${chip} bg-bad/20 text-bad`}>⨯ KILLED</span>
          ) : canKill ? (
            <button onClick={() => void killNow()} disabled={!currentAgent || result === null} className="rounded-lg border-2 border-bad/70 bg-bad/15 px-4 py-1.5 text-[13px] font-bold text-bad hover:bg-bad/25 disabled:opacity-40">⨯ KILL SWITCH</button>
          ) : (
            <span className="text-[10px] italic text-muted" title="Requires agent:kill">kill switch requires agent:kill</span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        {/* the cognition feed */}
        <div ref={feedRef} className="min-w-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-edge bg-ink p-3">
          {!result ? (
            <div className="grid h-full place-items-center text-center text-[13px] text-muted"><div><p className="text-fg">Pick a workflow and scenario, then Run cognition.</p><p className="mt-1">Watch the agents think — and watch the kernel decide.</p></div></div>
          ) : (
            <>
              {visible.map((ev, i) => <StreamRow key={i} ev={ev} />)}
              {running && !killed ? <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-brand" /> {currentAgent?.name ?? "agent"} thinking…</div> : null}
              {killed ? (
                <div className="rounded-lg border border-bad/50 bg-bad/10 p-3 text-[12px]">
                  <div className="font-semibold text-bad">⨯ Kill switch engaged on {killed.agent}</div>
                  <p className="mt-1 text-muted">The kernel halted the agent and <span className="text-fg">contained everything downstream, fail-closed</span>. These agents never ran:</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">{killed.contained.length ? killed.contained.map((c) => <span key={c} className={`${chip} bg-ink text-muted`}>{c} · not reached</span>) : <span className="text-muted">none downstream</span>}</div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* live governance envelope */}
        <div className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-xl border border-edge bg-panel">
          <div className="border-b border-edge px-4 py-2.5 text-[12px] font-semibold text-fg">Governance envelope (live)</div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-[12px]">
            {currentAgent ? (
              <>
                <div>
                  <div className="text-[13px] font-semibold text-fg">{currentAgent.name}</div>
                  <div className="text-[11px] text-muted">{currentAgent.role}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <span className={`${chip} bg-ink text-muted`}>Tier {currentAgent.tier}</span>
                  <span className={`${chip} bg-ink text-muted`}>θ_A ≥ {currentAgent.theta.alignment}</span>
                  <span className={`${chip} bg-ink text-muted`}>θ_C ≥ {currentAgent.theta.confidence}</span>
                  <span className={`${chip} bg-ink text-muted`}>{currentAgent.theta.containment}</span>
                  {currentAgent.theta.dualApproval ? <span className={`${chip} bg-warn/15 text-warn`}>dual-approval</span> : null}
                </div>
                <div className="rounded-md border border-edge bg-ink/50 p-2 text-[11px] text-muted"><span className="text-fg">Governance note:</span> {currentAgent.governanceNote}</div>
              </>
            ) : <p className="text-muted">The active agent&rsquo;s enforcement envelope (Θ thresholds, containment) appears here as it runs.</p>}
          </div>
          <div className="border-t border-edge px-4 py-2 text-[10px] leading-snug text-muted"><span className="text-warn">advisory</span> = the reasoning (never binds) · <span className="text-ok">binding</span> = the deterministic guard decision</div>
        </div>
      </div>
    </div>
  );
}

function StreamRow({ ev }: { ev: Ev }) {
  if (ev.t === "agent") {
    return (
      <div className="mt-2 flex items-center gap-2 border-t border-edge/60 pt-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-fg/10 text-fg">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="4" y="8" width="16" height="11" rx="2" /><path d="M12 3v3M9 13h.01M15 13h.01" /></svg>
        </span>
        <span className="text-[12.5px] font-semibold text-fg">{ev.a.name}</span>
        <span className="text-[10px] text-muted">Tier {ev.a.tier} · θ_C≥{ev.a.theta.confidence}</span>
      </div>
    );
  }
  if (ev.t === "thought") {
    return (
      <div className="ml-8 flex items-start gap-2">
        <span className={`${chip} mt-0.5 shrink-0 bg-warn/10 text-warn`}>reasoning</span>
        <span className="text-[12px] italic leading-snug text-muted">&ldquo;{ev.line}&rdquo;</span>
      </div>
    );
  }
  if (ev.t === "binding") {
    const s = ev.step;
    const blocked = s.outcome === "blocked";
    return (
      <div className="ml-8 rounded-md border border-edge bg-panel2/50 p-2">
        <div className="flex items-center gap-2">
          <span className={`${chip} ${blocked ? "bg-bad/15 text-bad" : "bg-ok/15 text-ok"}`}>binding · deterministic</span>
          <span className="font-mono text-[11px] text-fg">{s.action.id}</span>
          <span className={`ml-auto text-[11px] ${blocked ? "text-bad" : s.outcome === "verified" ? "text-ok" : "text-muted"}`}>{s.outcome}</span>
        </div>
        {s.verifyResult ? <div className="mt-1 text-[10.5px] text-muted">verifier: {s.verifyResult.detail}</div> : null}
        <div className="mt-1 flex flex-wrap gap-1">
          {s.guardEvaluations.map((g, i) => (
            <span key={i} className={`${chip} ${g.fired ? "bg-warn/15 text-warn" : "bg-ink text-muted"}`}>{g.guard}{g.fired ? " ◂fired" : ""}{g.score !== undefined && g.threshold !== undefined ? ` ${g.score}/${g.threshold}` : ""}</span>
          ))}
        </div>
      </div>
    );
  }
  // terminal
  const st = STATUS[ev.a.status];
  return (
    <div className="ml-8 flex items-center gap-2">
      <span className={`${chip} ${st.cls}`}>{st.label}</span>
      <span className="text-[11px] text-muted">{ev.a.rationale}</span>
    </div>
  );
}
