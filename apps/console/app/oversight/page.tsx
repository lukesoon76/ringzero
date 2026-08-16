"use client";

import { useEffect, useState } from "react";
import { usePermissions } from "../../components/PermissionsProvider";

type AgentStatus = "ok" | "contained" | "blocked" | "killed" | "skipped";
interface AgentRun {
  id: string;
  name: string;
  status: AgentStatus;
  terminalKind: string;
  rationale: string;
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
  scenarios: { id: string; label: string }[];
}
interface Item {
  key: string;
  pipeline: string;
  scenario: string;
  agent: string;
  subjectNode: string;
  reason: string;
  kind: AgentStatus;
}
interface Decision {
  decision: "approved" | "denied";
  approver: string;
  signature?: string;
  authentic?: boolean;
  detail?: string;
}

const STORE = "regent-oversight-decisions";
const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";

interface OversightModeDef {
  id: string; code: string; name: string; humanRole: string; description: string;
  latency: string; enforcement: string; euAiActArt14: string; autonomyLevels: number[];
}
interface ModeAgent { id: string; name: string; source: string; autonomy: string; level: number | null; severity: string; mode: string | null }
interface ModesData { modes: OversightModeDef[]; agents: ModeAgent[] }

export default function OversightPage() {
  const perms = usePermissions();
  const canApprove = !!perms?.has("oversight:approve");
  const [items, setItems] = useState<Item[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [loading, setLoading] = useState(true);
  const [modes, setModes] = useState<ModesData | null>(null);
  useEffect(() => { void (async () => setModes((await (await fetch("/api/oversight-modes")).json()) as ModesData))(); }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setDecisions(JSON.parse(raw) as Record<string, Decision>);
    } catch {
      /* ignore */
    }
    void (async () => {
      const man = (await (await fetch("/api/orchestrate")).json()) as { pipelines: Manifest[] };
      const post = async (pipeline: string, scenario: string) =>
        (await (await fetch("/api/orchestrate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pipeline, scenario }) })).json()) as { result: RunResult };
      const found: Item[] = [];
      for (const p of man.pipelines) {
        for (const s of p.scenarios) {
          if (s.id === "clean") continue;
          const { result } = await post(p.id, s.id);
          for (const a of result.agents) {
            if (a.status === "contained" || a.status === "blocked") {
              found.push({
                key: `${p.id}:${s.id}:${a.id}`,
                pipeline: p.label,
                scenario: s.label,
                agent: a.name,
                subjectNode: `${p.id}:${a.id}`,
                reason: a.rationale,
                kind: a.status,
              });
            }
          }
        }
      }
      setItems(found);
      setLoading(false);
    })();
  }, []);

  const persist = (next: Record<string, Decision>) => {
    setDecisions(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  async function decide(item: Item, action: "approve" | "deny") {
    const res = await fetch("/api/oversight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, subjectNode: item.subjectNode, approver: "risk-officer@bank", id: item.key }),
    });
    const json = (await res.json()) as { decision: "approved" | "denied"; record?: { signature: string }; authenticity?: { authentic: boolean; detail: string } };
    persist({
      ...decisions,
      [item.key]: {
        decision: json.decision,
        approver: "risk-officer@bank",
        signature: json.record?.signature,
        authentic: json.authenticity?.authentic,
        detail: json.authenticity?.detail,
      },
    });
  }

  const pending = items.filter((i) => !decisions[i.key]);
  const decided = items.filter((i) => decisions[i.key]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Human Oversight</h1>
        <p className="max-w-3xl text-[13px] text-muted">
          Escalated and contained runs awaiting an accountable human decision (EU AI Act Art. 14). An <span className="text-fg">Approve</span> mints
          a cryptographically <span className="text-fg">authenticated</span> approval for that exact node — a verbal or replayed
          &ldquo;yes&rdquo; will not authenticate. Decisions are auditable.
        </p>
      </div>

      <div className="flex gap-3 text-[12px]">
        <span className={`${chip} bg-warn/15 text-warn`}>{pending.length} pending</span>
        <span className={`${chip} bg-ok/15 text-ok`}>{decided.filter((i) => decisions[i.key]?.decision === "approved").length} approved</span>
        <span className={`${chip} bg-bad/15 text-bad`}>{decided.filter((i) => decisions[i.key]?.decision === "denied").length} denied</span>
      </div>

      {modes ? <OversightModes data={modes} /> : null}

      {loading ? (
        <p className="text-[13px] text-muted">Collecting escalations from governed runs…</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const d = decisions[it.key];
            return (
              <div key={it.key} className="rounded-xl border border-edge bg-panel p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`${chip} ${it.kind === "blocked" ? "bg-bad/15 text-bad" : "bg-warn/15 text-warn"}`}>{it.kind.toUpperCase()}</span>
                  <span className="text-[13px] font-semibold text-fg">{it.agent}</span>
                  <span className="text-[11px] text-muted">{it.pipeline} · {it.scenario}</span>
                  <code className="text-[10px] text-muted">{it.subjectNode}</code>
                  {!d ? (
                    canApprove ? (
                      <div className="ml-auto flex gap-2">
                        <button onClick={() => decide(it, "approve")} className="rounded-lg bg-brand px-3 py-1 text-[11px] font-semibold text-ink">Approve</button>
                        <button onClick={() => decide(it, "deny")} className="rounded-lg border border-edge px-3 py-1 text-[11px] text-muted hover:text-bad">Deny</button>
                      </div>
                    ) : (
                      <span className="ml-auto text-[10px] italic text-muted" title="Requires the oversight:approve permission (Approver / Admin)">read-only — approval requires the Approver role</span>
                    )
                  ) : (
                    <span className={`ml-auto ${chip} ${d.decision === "approved" ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad"}`}>{d.decision.toUpperCase()}</span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted">{it.reason}</p>
                {d?.decision === "approved" ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md border border-edge bg-ink/50 px-2.5 py-1.5 text-[11px]">
                    <span className={`${chip} ${d.authentic ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad"}`}>{d.authentic ? "AUTHENTICATED ✓" : "UNAUTHENTIC"}</span>
                    <span className="text-muted">{d.detail}</span>
                    {d.signature ? <code className="text-muted">sig {d.signature.slice(0, 16)}…</code> : null}
                    <span className="text-muted">by {d.approver}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
          {items.length === 0 ? <p className="text-[13px] text-muted">No escalations — all governed runs completed cleanly.</p> : null}
        </div>
      )}
    </div>
  );
}

const MODE_TONE: Record<string, string> = { hitl: "bg-ok/15 text-ok", hotl: "bg-warn/15 text-warn", hic: "bg-link/15 text-link", autonomous: "bg-bad/15 text-bad" };

function OversightModes({ data }: { data: ModesData }) {
  const [sel, setSel] = useState<string>("hitl");
  const active = data.modes.find((m) => m.id === sel) ?? data.modes[0]!;
  const inMode = data.agents.filter((a) => a.mode === active.id);
  return (
    <div className="space-y-3 rounded-xl border border-edge bg-panel p-4">
      <div>
        <h2 className="text-sm font-semibold text-fg">Human oversight modes — the spectrum</h2>
        <p className="max-w-3xl text-[12px] text-muted">
          As an agent&rsquo;s autonomy rises, the human moves from <span className="text-fg">in</span> the loop (approve each action)
          to <span className="text-fg">on</span> it (supervise &amp; intervene) to <span className="text-fg">in command</span>
          {" "}(policy + post-hoc). Each mode is backed by real kernel enforcement, not an SLA. Click a mode to see how Regent binds it.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {data.modes.map((m) => {
          const n = data.agents.filter((a) => a.mode === m.id).length;
          return (
            <button key={m.id} onClick={() => setSel(m.id)} className={`rounded-lg border p-2.5 text-left transition ${sel === m.id ? "border-fg" : "border-edge hover:border-fg/40"}`}>
              <div className="flex items-center justify-between">
                <span className={`${chip} ${MODE_TONE[m.id]}`}>{m.code}</span>
                <span className="text-[11px] text-muted">{n} agent{n === 1 ? "" : "s"}</span>
              </div>
              <div className="mt-1 text-[12px] font-semibold text-fg">{m.name}</div>
              <div className="mt-0.5 text-[10px] leading-snug text-muted">{m.humanRole}</div>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-edge bg-ink/40 p-3 md:grid-cols-2">
        <div className="space-y-1.5 text-[12px]">
          <div><span className={`${chip} ${MODE_TONE[active.id]}`}>{active.code}</span> <span className="text-fg">{active.name}</span> <span className="text-muted">· human acts {active.latency}</span></div>
          <p className="text-[11px] leading-snug text-muted">{active.description}</p>
          <div className="pt-1 text-[10px] uppercase tracking-wide text-muted">Regent enforces</div>
          <p className="text-[11px] leading-snug text-fg">{active.enforcement}</p>
          <div className="pt-1 text-[10px] uppercase tracking-wide text-muted">EU AI Act Art. 14</div>
          <p className="text-[11px] leading-snug text-muted">{active.euAiActArt14}</p>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">Agents in this mode (autonomy {active.autonomyLevels.map((l) => `L${l}`).join("/")}) — {inMode.length}</div>
          {inMode.length === 0 ? <p className="text-[11px] text-muted">No discovered agents currently map to {active.code}.</p> : (
            <ul className="space-y-1">
              {inMode.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-[11.5px]">
                  <span className={`${chip} ${a.severity === "critical" ? "bg-bad/15 text-bad" : a.severity === "watch" ? "bg-warn/15 text-warn" : "bg-ok/15 text-ok"}`}>{a.autonomy}</span>
                  <span className="text-fg">{a.name}</span>
                  <span className="font-mono text-[10px] text-muted">{a.source}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
