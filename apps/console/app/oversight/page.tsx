"use client";

import { useEffect, useState } from "react";

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

export default function OversightPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [loading, setLoading] = useState(true);

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
                    <div className="ml-auto flex gap-2">
                      <button onClick={() => decide(it, "approve")} className="rounded-lg bg-brand px-3 py-1 text-[11px] font-semibold text-ink">Approve</button>
                      <button onClick={() => decide(it, "deny")} className="rounded-lg border border-edge px-3 py-1 text-[11px] text-muted hover:text-bad">Deny</button>
                    </div>
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
