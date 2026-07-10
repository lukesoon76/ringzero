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
type Verdict = "binding" | "unverified" | "shadow" | "gap";
interface CombinedCell {
  asset: string;
  assetName: string;
  assetClass: "agent" | "model";
  controlId: string;
  standard: string;
  title: string;
  severity: string;
  status: string;
  detail: string;
  declared: boolean;
  exercised: boolean;
  verdict: Verdict;
}
interface StandardRollup {
  standard: string;
  applicable: number;
  covered: number;
  coveragePct: number;
}
interface Estate {
  // only the fields the view consumes; `combined` carries the fused verdict.
  combined: CombinedCell[];
  byStandard: StandardRollup[];
  coveragePct: number;
  assetCount: number;
  verdicts: { binding: number; unverified: number; shadow: number; gap: number };
}
interface CatalogCol {
  controlId: string;
  standard: string;
  title: string;
  appliesTo: "agent" | "model" | "both";
}
interface Data {
  assets: Asset[];
  columns: Column[];
  portfolio: PortfolioRow[];
  estate: Estate;
  catalog: CatalogCol[];
}

const VERDICT: Record<Verdict, { cls: string; label: string }> = {
  binding: { cls: "bg-ok/15 text-ok", label: "BINDING" },
  unverified: { cls: "bg-warn/15 text-warn", label: "UNVERIFIED" },
  shadow: { cls: "bg-link/15 text-link", label: "SHADOW" },
  gap: { cls: "bg-bad/15 text-bad", label: "GAP" },
};

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
          {/* estate attestation — declared × exercised */}
          <EstateSection estate={data.estate} catalog={data.catalog} />

          <h2 className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted">Per-agent framework coverage (declared)</h2>
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

function EstateSection({ estate, catalog }: { estate: Estate; catalog: CatalogCol[] }) {
  // unique assets in first-seen order, carrying their class
  const assets: { id: string; name: string; cls: "agent" | "model" }[] = [];
  const seen = new Set<string>();
  for (const c of estate.combined) {
    if (seen.has(c.asset)) continue;
    seen.add(c.asset);
    assets.push({ id: c.asset, name: c.assetName, cls: c.assetClass });
  }
  const cell = (assetId: string, controlId: string) =>
    estate.combined.find((c) => c.asset === assetId && c.controlId === controlId);

  const v = estate.verdicts;
  const cards: { key: Verdict; n: number }[] = [
    { key: "binding", n: v.binding },
    { key: "unverified", n: v.unverified },
    { key: "shadow", n: v.shadow },
    { key: "gap", n: v.gap },
  ];

  // Non-binding cells from `combined` (which carry the fused `verdict`), severity-ranked.
  // NB: estate.gaps inherits the declared-axis CoverageCell shape (status, no verdict).
  const sevRank: Record<string, number> = { critical: 0, high: 1, medium: 2 };
  const verdictRank: Record<Verdict, number> = { gap: 0, shadow: 1, unverified: 2, binding: 9 };
  const gapCells = estate.combined
    .filter((c) => c.verdict !== "binding")
    .slice()
    .sort((a, b) => verdictRank[a.verdict] - verdictRank[b.verdict] || (sevRank[a.severity] ?? 3) - (sevRank[b.severity] ?? 3) || a.asset.localeCompare(b.asset));

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-fg">Estate attestation — declared × exercised</h2>
          <a
            href="/api/attestation?format=html"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-edge px-2.5 py-1 text-[11px] font-semibold text-fg hover:border-fg/40"
            title="Open the portable, print-to-PDF estate attestation (auditor artifact)"
          >
            ⎙ Export estate (PDF)
          </a>
        </div>
        <p className="max-w-3xl text-[12px] text-muted">
          Every AI asset (agents <span className="text-fg">and</span> models) against the control catalogue, fusing two
          honest axes: <span className="text-fg">declared</span> (a deterministic control is bound) and{" "}
          <span className="text-fg">exercised</span> (the control actually fired in a compiled dry‑run).{" "}
          <span className="text-ok">Binding</span> = declared ∧ exercised. <span className="text-warn">Unverified</span> =
          declared ∧ ¬exercised. <span className="text-link">Shadow</span> = exercised ∧ ¬declared.{" "}
          <span className="text-bad">Gap</span> = neither. Estate coverage{" "}
          <span className="font-mono text-fg">{estate.coveragePct}%</span> over{" "}
          <span className="font-mono text-fg">{estate.assetCount}</span> assets.
        </p>
      </div>

      {/* verdict summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.key} className="rounded-xl border border-edge bg-panel p-3">
            <div className="flex items-center justify-between">
              <span className={`${chip} ${VERDICT[c.key].cls}`}>{VERDICT[c.key].label}</span>
              <span className="text-[18px] font-semibold tabular-nums text-fg">{c.n}</span>
            </div>
          </div>
        ))}
      </div>

      {/* estate matrix: asset × control */}
      <div className="overflow-x-auto rounded-xl border border-edge">
        <table className="w-full min-w-[900px] text-[12px]">
          <thead className="bg-panel2 text-[10px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 text-left">Asset → control</th>
              {catalog.map((c) => (
                <th key={c.controlId} className="px-2 py-2 text-center" title={`${c.standard} — ${c.title}`}>
                  <span className="font-mono">{c.controlId}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="border-t border-edge">
                <td className="px-3 py-2 text-fg">
                  <span className={`${chip} mr-1.5 ${a.cls === "model" ? "bg-link/15 text-link" : "bg-edge/60 text-muted"}`}>{a.cls}</span>
                  {a.name}
                </td>
                {catalog.map((c) => {
                  const applies = c.appliesTo === "both" || c.appliesTo === a.cls;
                  const cc = applies ? cell(a.id, c.controlId) : undefined;
                  return (
                    <td key={c.controlId} className="px-2 py-2 text-center">
                      {!applies ? (
                        <span className="text-muted">·</span>
                      ) : cc ? (
                        <span className={`${chip} ${VERDICT[cc.verdict].cls}`} title={cc.detail}>{VERDICT[cc.verdict].label}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* per-standard rollup */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {estate.byStandard.map((s) => (
          <div key={s.standard} className="rounded-xl border border-edge bg-panel p-3">
            <div className="flex items-center justify-between text-[10px] text-muted">
              <span className="font-mono text-fg">{s.standard}</span>
              <span>{s.covered}/{s.applicable}</span>
            </div>
            <div className="mt-1.5 text-[15px] font-semibold tabular-nums text-fg">{s.coveragePct}%</div>
            <div className="mt-1 h-1.5 rounded-sm bg-ink">
              <div className={`h-1.5 rounded-sm ${s.coveragePct >= 100 ? "bg-ok" : s.coveragePct > 0 ? "bg-warn" : "bg-bad"}`} style={{ width: `${s.coveragePct}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* severity-ranked non-binding cells */}
      {gapCells.length > 0 ? (
        <div className="rounded-xl border border-edge bg-panel">
          <div className="border-b border-edge px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Open findings ({gapCells.length})
          </div>
          <ul className="divide-y divide-edge">
            {gapCells.map((g, i) => (
              <li key={`${g.asset}:${g.controlId}:${i}`} className="flex items-start gap-2 px-3 py-2 text-[12px]">
                <span className={`${chip} ${VERDICT[g.verdict].cls}`}>{VERDICT[g.verdict].label}</span>
                <span className="text-fg">{g.assetName}</span>
                <span className="text-muted">— {g.standard}: {g.title}</span>
                <span className="ml-auto text-[11px] text-muted">{g.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
