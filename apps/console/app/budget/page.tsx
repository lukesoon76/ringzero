"use client";

import { useCallback, useEffect, useState } from "react";

type Outcome = "permitted" | "contained";
interface Decision {
  call: { tool: string; operation?: string; tokens?: number; costUsd?: number };
  outcome: Outcome;
  cumulativeTokens: number;
  cumulativeCostUsd: number;
  control: string;
  clause: string;
  reason: string;
}
interface Result {
  config: { tokenBudget: number; costBudgetUsd: number; strict: boolean };
  decisions: Decision[];
  finalTokens: number;
  finalCostUsd: number;
}

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";
const OUTCOME: Record<Outcome, string> = { permitted: "bg-ok/15 text-ok", contained: "bg-warn/15 text-warn" };
const tok = (n?: number) => (n === undefined ? "0" : n.toLocaleString("en-US"));
const usd = (n?: number) => (n === undefined ? "$0.00" : `$${n.toFixed(2)}`);

export default function BudgetPage() {
  const [tokenBudget, setTokenBudget] = useState(200_000);
  const [costBudget, setCostBudget] = useState(5);
  const [strict, setStrict] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/budget", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tokenBudget, costBudgetUsd: costBudget, strict }) });
      setResult((await res.json()) as Result);
    } finally {
      setBusy(false);
    }
  }, [tokenBudget, costBudget, strict]);

  useEffect(() => {
    void run();
  }, [run]);

  const contained = result ? result.decisions.filter((d) => d.outcome === "contained").length : 0;
  const permitted = result ? result.decisions.filter((d) => d.outcome === "permitted").length : 0;
  const tokPct = result ? Math.min(100, Math.round((result.finalTokens / result.config.tokenBudget) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Cost / Token Budget</h1>
        <p className="max-w-3xl text-[13px] text-muted">
          A deterministic runtime meter that caps the cumulative <span className="text-fg">tokens</span> and{" "}
          <span className="text-fg">cost</span> a run may consume, and <span className="text-warn">contains</span> the
          trajectory before the call that would breach the ceiling. This is the runtime answer to runaway /
          recursively-self-improving agent loops — a non-deterministic loop can&rsquo;t drain budget a step at a time past
          the cap. Fail-closed; every containment cites the exact figures for replay.
        </p>
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-edge bg-panel p-4">
        <label className="flex items-center gap-2 text-[12px]">
          <span className="text-muted">Token budget</span>
          <input type="range" min={100_000} max={400_000} step={20_000} value={tokenBudget} onChange={(e) => setTokenBudget(Number(e.target.value))} className="w-40 accent-white" />
          <span className="w-20 text-fg tabular-nums">{tok(tokenBudget)}</span>
        </label>
        <label className="flex items-center gap-2 text-[12px]">
          <span className="text-muted">Cost budget</span>
          <input type="range" min={1} max={10} step={0.5} value={costBudget} onChange={(e) => setCostBudget(Number(e.target.value))} className="w-32 accent-white" />
          <span className="w-14 text-fg tabular-nums">{usd(costBudget)}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[12px]">
          <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} className="h-4 w-4 accent-white" />
          <span className="text-fg">Strict — contain unmetered calls (fail-closed on unknown)</span>
        </label>
        <span className="ml-auto text-[11px] text-muted">{busy ? "evaluating…" : "deterministic · fail-closed"}</span>
      </div>

      {result ? (
        <>
          {/* summary */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Permitted" value={`${permitted}`} tone="ok" />
            <Kpi label="Contained (budget breach)" value={`${contained}`} tone="warn" />
            <div className="rounded-xl border border-edge bg-panel p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted">Tokens consumed</div>
              <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-fg">{tok(result.finalTokens)} <span className="text-muted">/ {tok(result.config.tokenBudget)}</span></div>
              <div className="mt-1 h-2 rounded-sm bg-ink">
                <div className={`h-2 rounded-sm ${tokPct >= 100 ? "bg-bad" : tokPct >= 80 ? "bg-warn" : "bg-ok"}`} style={{ width: `${tokPct}%` }} />
              </div>
            </div>
            <Kpi label="Cost consumed" value={`${usd(result.finalCostUsd)} / ${usd(result.config.costBudgetUsd)}`} tone="ok" />
          </div>

          {/* session ledger */}
          <div className="overflow-x-auto rounded-xl border border-edge">
            <table className="w-full min-w-[820px] text-[12px]">
              <thead className="bg-panel2 text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Call</th>
                  <th className="px-3 py-2 text-right">Tokens</th>
                  <th className="px-3 py-2 text-right">Cost</th>
                  <th className="px-3 py-2 text-left">Decision</th>
                  <th className="px-3 py-2 text-right">Cumulative tokens</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                </tr>
              </thead>
              <tbody>
                {result.decisions.map((d, i) => (
                  <tr key={i} className="border-t border-edge align-top">
                    <td className="px-3 py-2 text-muted">{i + 1}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-fg">{d.call.operation ?? d.call.tool}</span>
                      <div className="text-[10px] text-muted">{d.call.tool}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-fg">{tok(d.call.tokens)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{usd(d.call.costUsd)}</td>
                    <td className="px-3 py-2"><span className={`${chip} ${OUTCOME[d.outcome]}`}>{d.outcome.toUpperCase()}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{tok(d.cumulativeTokens)}</td>
                    <td className="px-3 py-2">
                      {d.outcome === "permitted" ? <span className="text-muted">—</span> : (
                        <div>
                          <div className="text-fg">{d.control}</div>
                          <div className="text-[10px] text-muted">{d.reason}</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted">
            The recursive <code className="text-fg">expand</code> loop keeps consuming tokens; the call that would cross the
            budget is <span className="text-warn">contained</span> deterministically — the runaway is stopped, not flagged
            after the fact. Lower the budget to contain it earlier, or enable <span className="text-fg">strict</span> to also
            fail-closed on any unmetered call.
          </p>
        </>
      ) : (
        <p className="text-[13px] text-muted">Running the session…</p>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-bad";
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
