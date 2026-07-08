"use client";

import { Fragment, useEffect, useState } from "react";

type ClauseStatus = "attested" | "advisory-only";
interface ClauseCoverage {
  clause: string;
  status: ClauseStatus;
  controls: { label: string; strength: "deterministic" | "advisory" | "detective" }[];
}
interface FrameworkCoverage {
  framework: string;
  clauses: ClauseCoverage[];
  attested: number;
  total: number;
  coveragePct: number;
}
interface Asset {
  id: string;
  name: string;
  source: string;
  frameworks: FrameworkCoverage[];
  gaps: string[];
}
interface Column {
  id: string;
  shortName: string;
}
interface PortfolioRow {
  framework: string;
  shortName: string;
  attested: number;
  total: number;
  coveragePct: number;
}
interface Data {
  assets: Asset[];
  columns: Column[];
  portfolio: PortfolioRow[];
}

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";
const covCls = (pct: number) => (pct >= 100 ? "bg-ok/15 text-ok" : pct > 0 ? "bg-warn/15 text-warn" : "bg-bad/15 text-bad");
const STRENGTH: Record<string, string> = { deterministic: "text-ok", advisory: "text-warn", detective: "text-muted" };

export function AttestationView({ demoHtml }: { demoHtml: string | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<string>("");
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    void (async () => {
      const json = (await (await fetch("/api/attestation")).json()) as Data;
      setData(json);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Attestation</h1>
        <p className="max-w-3xl text-[13px] text-muted">
          P6 attestation as a <span className="text-fg">pure projection</span> of the P1 inventory — each agent&rsquo;s bound
          controls mapped to framework clauses. A clause is <span className="text-ok">attested</span> only when a{" "}
          <span className="text-fg">deterministic</span> control covers it; advisory/detective controls leave it a{" "}
          <span className="text-warn">gap</span>. Nothing here is hand‑maintained — same substrate as enforcement.
        </p>
      </div>

      {!data ? (
        <p className="text-[13px] text-muted">Projecting attestation from the inventory…</p>
      ) : (
        <>
          {/* portfolio coverage */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {data.portfolio.map((p) => (
              <div key={p.framework} className="rounded-xl border border-edge bg-panel p-3">
                <div className="flex items-center justify-between text-[10px] text-muted">
                  <span className="font-mono text-fg">{p.shortName}</span>
                  <span>{p.attested}/{p.total}</span>
                </div>
                <div className="mt-1.5 text-[15px] font-semibold tabular-nums text-fg">{p.coveragePct}%</div>
                <div className="mt-1 h-1.5 rounded-sm bg-ink">
                  <div className={`h-1.5 rounded-sm ${p.coveragePct >= 100 ? "bg-ok" : p.coveragePct > 0 ? "bg-warn" : "bg-bad"}`} style={{ width: `${p.coveragePct}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* coverage matrix: agent × framework */}
          <div className="overflow-x-auto rounded-xl border border-edge">
            <table className="w-full min-w-[820px] text-[12px]">
              <thead className="bg-panel2 text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Agent → framework</th>
                  {data.columns.map((c) => (
                    <th key={c.id} className={`px-3 py-2 text-center ${c.id === "mas-safr" ? "text-fg" : ""}`}>{c.shortName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.assets.map((a) => (
                  <Fragment key={a.id}>
                    <tr className="cursor-pointer border-t border-edge hover:bg-panel2/40" onClick={() => setOpen(open === a.id ? "" : a.id)}>
                      <td className="px-3 py-2 text-fg">{a.name}</td>
                      {data.columns.map((c) => {
                        const f = a.frameworks.find((x) => x.framework === c.id);
                        return (
                          <td key={c.id} className="px-3 py-2 text-center">
                            {f ? <span className={`${chip} ${covCls(f.coveragePct)}`}>{f.attested}/{f.total}</span> : <span className="text-muted">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                    {open === a.id ? (
                      <tr className="border-t border-edge bg-ink/40">
                        <td colSpan={data.columns.length + 1} className="px-3 py-2">
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {a.frameworks.map((f) => (
                              <div key={f.framework} className="rounded-md border border-edge p-2">
                                <div className="mb-1 flex items-center justify-between">
                                  <span className="font-mono text-[11px] text-fg">{data.columns.find((c) => c.id === f.framework)?.shortName ?? f.framework}</span>
                                  <span className={`${chip} ${covCls(f.coveragePct)}`}>{f.coveragePct}%</span>
                                </div>
                                <ul className="space-y-1">
                                  {f.clauses.map((cl) => (
                                    <li key={cl.clause} className="text-[11px]">
                                      <span className={`${chip} ${cl.status === "attested" ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"}`}>{cl.status === "attested" ? "attested" : "gap"}</span>{" "}
                                      <span className="text-fg">{cl.clause}</span>
                                      <span className="text-muted"> — {cl.controls.map((x) => `${x.label} (${x.strength})`).join(", ")}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted">Click an agent to see the clause‑level breakdown. Cells show attested / total clauses; <span className="text-ok">green</span> = fully deterministic, <span className="text-warn">amber</span> = partial (advisory‑only gaps), <span className="text-bad">red</span> = none attested.</p>

          {/* legacy print-ready artifact */}
          {demoHtml ? (
            <div className="rounded-xl border border-edge bg-panel">
              <button onClick={() => setShowDemo((v) => !v)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[12px] text-muted hover:text-fg">
                <span>Print‑ready attestation (from <code className="text-fg">pnpm demo</code> — credit‑memo run)</span>
                <span>{showDemo ? "hide" : "show"}</span>
              </button>
              {showDemo ? <iframe srcDoc={demoHtml} title="attestation" className="h-[70vh] w-full rounded-b-xl border-t border-edge" /> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
