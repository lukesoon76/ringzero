"use client";

import { useEffect, useState } from "react";

interface EvalCase {
  pipeline: string;
  pipelineLabel: string;
  name: string;
  kind: "clean" | "attack" | "governance-lever" | "kill-switch";
  expected: "released" | "contained";
  released: boolean;
  contained: boolean;
  pass: boolean;
}
interface EvalReport {
  cases: EvalCase[];
  passed: number;
  total: number;
  passRate: number;
}

const STORE = "regent-assurance-history";
const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";
const KIND: Record<EvalCase["kind"], string> = { clean: "clean", attack: "attack", "governance-lever": "governance", "kill-switch": "kill-switch" };

export default function AssurancePage() {
  const [report, setReport] = useState<EvalReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setHistory(JSON.parse(raw) as number[]);
    } catch {
      /* ignore */
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    setBusy(true);
    try {
      const json = (await (await fetch("/api/eval")).json()) as { report: EvalReport };
      setReport(json.report);
      setHistory((h) => {
        const next = [...h, json.report.passRate].slice(-24);
        try {
          localStorage.setItem(STORE, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  const byPipeline = (report?.cases ?? []).reduce<Record<string, EvalCase[]>>((m, c) => {
    (m[c.pipelineLabel] ??= []).push(c);
    return m;
  }, {});
  const max = Math.max(1, ...history);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-fg">Assurance</h1>
          <p className="max-w-3xl text-[13px] text-muted">
            A deterministic red-team suite (P3) run across every pipeline: clean runs must release; the named attacks, max
            governance, and the kill switch must all contain. Re-runnable — this is &ldquo;prove it keeps working&rdquo; as a button.
          </p>
        </div>
        <button onClick={run} disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-ink disabled:opacity-50">
          {busy ? "running…" : "Run assurance suite ▶"}
        </button>
      </div>

      {report ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Pass rate" value={`${report.passRate}%`} tone={report.passRate === 100 ? "ok" : "bad"} />
            <Kpi label="Cases passed" value={`${report.passed}/${report.total}`} />
            <Kpi label="Attacks contained" value={`${report.cases.filter((c) => c.kind === "attack" && c.pass).length}`} tone="ok" />
            <div className="rounded-xl border border-edge bg-panel p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted">Pass-rate history</div>
              <div className="mt-2 flex h-8 items-end gap-[3px]">
                {history.map((v, i) => (
                  <div key={i} className="flex-1 rounded-sm bg-ok" style={{ height: `${Math.max(6, (v / max) * 100)}%`, opacity: 0.4 + (i / history.length) * 0.6 }} />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(byPipeline).map(([label, cases]) => (
              <div key={label} className="overflow-hidden rounded-xl border border-edge">
                <div className="flex items-center justify-between bg-panel2 px-3 py-2">
                  <span className="text-[12px] font-semibold text-fg">{label}</span>
                  <span className="text-[11px] text-muted">{cases.filter((c) => c.pass).length}/{cases.length} passed</span>
                </div>
                <table className="w-full text-[12px]">
                  <tbody>
                    {cases.map((c) => (
                      <tr key={c.name} className="border-t border-edge">
                        <td className="px-3 py-2">
                          <span className={`${chip} bg-ink text-muted`}>{KIND[c.kind]}</span>
                        </td>
                        <td className="px-3 py-2 text-fg">{c.name}</td>
                        <td className="px-3 py-2 text-muted">expected {c.expected}</td>
                        <td className="px-3 py-2 text-muted">got {c.released ? "released" : "contained"}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`${chip} ${c.pass ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad"}`}>{c.pass ? "PASS" : "FAIL"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[13px] text-muted">Running the suite…</p>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  const color = tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "text-fg";
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
