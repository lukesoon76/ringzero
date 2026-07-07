"use client";

import { useCallback, useEffect, useState } from "react";

type MaterialityRating = "low" | "medium" | "high" | "critical";
type FinanceOutcome = "permitted" | "blocked" | "contained";
interface Decision {
  call: { tool: string; operation: string; amount?: number; riskProfileChange?: boolean };
  outcome: FinanceOutcome;
  materiality: MaterialityRating;
  cumulativeExposure: number;
  control: string;
  clause: string;
  reason: string;
}
interface Result {
  config: { sessionExposureCap: number; allowedOperations: string[]; requireApprovalAtOrAbove: string };
  decisions: Decision[];
  finalExposure: number;
}

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";
const OUTCOME: Record<FinanceOutcome, string> = { permitted: "bg-ok/15 text-ok", blocked: "bg-bad/15 text-bad", contained: "bg-warn/15 text-warn" };
const MAT: Record<MaterialityRating, string> = { low: "bg-ink text-muted", medium: "bg-fg/10 text-fg", high: "bg-warn/15 text-warn", critical: "bg-bad/15 text-bad" };
const fmt = (n?: number) => (n === undefined ? "$0" : `$${n.toLocaleString("en-US")}`);

export default function FinancePage() {
  const [cap, setCap] = useState(2_000_000);
  const [approve, setApprove] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/finance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionExposureCap: cap, approveCritical: approve }) });
      setResult((await res.json()) as Result);
    } finally {
      setBusy(false);
    }
  }, [cap, approve]);

  useEffect(() => {
    void run();
  }, [run]);

  const counts = result
    ? result.decisions.reduce(
        (m, d) => ({ ...m, [d.outcome]: (m[d.outcome] ?? 0) + 1 }),
        {} as Record<FinanceOutcome, number>,
      )
    : ({} as Record<FinanceOutcome, number>);
  const capPct = result ? Math.min(100, Math.round((result.finalExposure / result.config.sessionExposureCap) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Financial Runtime Controls</h1>
        <p className="max-w-3xl text-[13px] text-muted">
          A deterministic runtime checkpoint (SAFR-style) for agentic finance. Before any financial operation executes, the
          interceptor enforces three controls, fail-closed: <span className="text-fg">scope mandate</span>,{" "}
          <span className="text-fg">dynamic materiality</span> (with an active human-in-the-loop barrier), and a{" "}
          <span className="text-fg">cumulative session-exposure cap</span>. Every block cites its control and framework clause.
        </p>
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-edge bg-panel p-4">
        <label className="flex items-center gap-2 text-[12px]">
          <span className="text-muted">Session exposure cap</span>
          <input type="range" min={500_000} max={5_000_000} step={250_000} value={cap} onChange={(e) => setCap(Number(e.target.value))} className="w-48 accent-white" />
          <span className="w-24 text-fg tabular-nums">{fmt(cap)}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[12px]">
          <input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} className="h-4 w-4 accent-white" />
          <span className="text-fg">Authenticated human validation for Critical events</span>
        </label>
        <span className="ml-auto text-[11px] text-muted">{busy ? "evaluating…" : "deterministic · fail-closed"}</span>
      </div>

      {result ? (
        <>
          {/* summary */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Permitted" value={counts.permitted ?? 0} tone="ok" />
            <Kpi label="Blocked (scope / materiality)" value={counts.blocked ?? 0} tone="bad" />
            <Kpi label="Contained (exposure cap)" value={counts.contained ?? 0} tone="warn" />
            <div className="rounded-xl border border-edge bg-panel p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted">Session exposure</div>
              <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-fg">{fmt(result.finalExposure)} <span className="text-muted">/ {fmt(result.config.sessionExposureCap)}</span></div>
              <div className="mt-1 h-2 rounded-sm bg-ink">
                <div className={`h-2 rounded-sm ${capPct >= 100 ? "bg-bad" : capPct >= 80 ? "bg-warn" : "bg-ok"}`} style={{ width: `${capPct}%` }} />
              </div>
            </div>
          </div>

          {/* session ledger */}
          <div className="overflow-x-auto rounded-xl border border-edge">
            <table className="w-full min-w-[860px] text-[12px]">
              <thead className="bg-panel2 text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Operation</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Materiality</th>
                  <th className="px-3 py-2 text-left">Decision</th>
                  <th className="px-3 py-2 text-right">Cumulative</th>
                  <th className="px-3 py-2 text-left">Control · clause</th>
                </tr>
              </thead>
              <tbody>
                {result.decisions.map((d, i) => (
                  <tr key={i} className="border-t border-edge align-top">
                    <td className="px-3 py-2 text-muted">{i + 1}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-fg">{d.call.operation}</span>
                      {d.call.riskProfileChange ? <span className={`${chip} ml-1 bg-warn/15 text-warn`}>risk-profile Δ</span> : null}
                      <div className="text-[10px] text-muted">{d.call.tool}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-fg">{fmt(d.call.amount)}</td>
                    <td className="px-3 py-2"><span className={`${chip} ${MAT[d.materiality]}`}>{d.materiality}</span></td>
                    <td className="px-3 py-2"><span className={`${chip} ${OUTCOME[d.outcome]}`}>{d.outcome.toUpperCase()}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{fmt(d.cumulativeExposure)}</td>
                    <td className="px-3 py-2">
                      {d.outcome === "permitted" ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <div>
                          <div className="text-fg">{d.control}</div>
                          <div className="text-[10px] text-muted">{d.clause} · {d.reason}</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted">
            Toggle human validation to see the Critical rebalance flip from <span className="text-bad">blocked</span> to{" "}
            <span className="text-ok">permitted</span> — then watch cumulative exposure trip the cap and{" "}
            <span className="text-warn">contain</span> the session. Every decision is deterministic and replayable.
          </p>
        </>
      ) : (
        <p className="text-[13px] text-muted">Running the session…</p>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-bad";
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
