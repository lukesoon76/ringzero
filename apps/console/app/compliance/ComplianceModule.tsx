"use client";

import { useEffect, useMemo, useState } from "react";
import { getEffective, type Pack } from "../../lib/frameworks-store";

type Status = "compliant" | "gaps" | "breach";
type ReqStatus = "compliant" | "gap" | "breach" | "manual";
interface ReqResult {
  frameworkShort: string;
  requirementId: string;
  title: string;
  severity: string;
  status: ReqStatus;
  rationale: string;
}
interface AgentCompliance {
  agentId: string;
  agentName: string;
  results: ReqResult[];
  counts: { compliant: number; gap: number; breach: number; manual: number };
  status: Status;
  score: number;
}
interface Matrix {
  id: string;
  label: string;
  region: string;
  frameworks: string[];
  perAgent: { id: string; name: string; status: Status }[];
  status: Status;
}
interface Result {
  meshed: AgentCompliance[];
  portfolio: { breach: number; gaps: number; compliant: number; status: Status };
  matrix: Matrix[];
}

const JURISDICTIONS = [
  { id: "sg", label: "Singapore", frameworks: ["mas-feat", "mas-ai-rg", "mas-safr", "sg-mgf"] },
  { id: "eu", label: "European Union", frameworks: ["eu-ai-act", "iso-42001"] },
  { id: "us", label: "United States", frameworks: ["nist-ai-rmf", "colorado-sb21-169", "nyc-ll144"] },
  { id: "intl", label: "International", frameworks: ["iso-42001", "nist-ai-rmf"] },
];

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";
const POSTURE: Record<Status, string> = { compliant: "bg-ok/15 text-ok", gaps: "bg-warn/15 text-warn", breach: "bg-bad/15 text-bad" };
const REQ: Record<ReqStatus, string> = { compliant: "bg-ok/15 text-ok", gap: "bg-warn/15 text-warn", breach: "bg-bad/15 text-bad", manual: "bg-ink text-muted" };
const DOT: Record<Status, string> = { compliant: "bg-ok", gaps: "bg-warn", breach: "bg-bad" };

export function ComplianceModule({ builtins }: { builtins: Pack[] }) {
  const [effective, setEffective] = useState<Pack[]>(builtins);
  const [selectedIds, setSelectedIds] = useState<string[]>(["eu-ai-act", "mas-ai-rg", "sg-mgf"]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [openAgent, setOpenAgent] = useState<string>("");

  // effective = built-ins + uploads/edits from localStorage.
  useEffect(() => {
    setEffective(getEffective(builtins));
  }, [builtins]);

  const key = useMemo(() => [...selectedIds].sort().join(","), [selectedIds]);
  useEffect(() => {
    if (effective.length === 0 || selectedIds.length === 0) return;
    setBusy(true);
    void (async () => {
      const res = await fetch("/api/compliance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frameworks: effective, selectedIds }),
      });
      const json = (await res.json()) as { meshed: AgentCompliance[]; portfolio: Result["portfolio"]; matrix: Matrix[] };
      setResult({ meshed: json.meshed, portfolio: json.portfolio, matrix: json.matrix });
      setBusy(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, effective]);

  const toggle = (id: string) => setSelectedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const applyJurisdiction = (fw: string[]) => setSelectedIds(fw.filter((id) => effective.some((f) => f.id === id)));

  const agentsSorted = result ? [...result.meshed].sort((a, b) => rank(b.status) - rank(a.status)) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Compliance</h1>
        <p className="max-w-3xl text-[13px] text-muted">
          Evaluate every agent against a <span className="text-fg">mesh of frameworks</span> and compare posture across
          jurisdictions (franchises). A <span className="text-bad">breach</span> is an unmet <em>critical</em> control; a{" "}
          <span className="text-warn">gap</span> a high/medium one; fairness/transparency stay <span className="text-fg">manual</span>.
          Upload or edit frameworks on the Frameworks page and the posture updates.
        </p>
      </div>

      {/* profile builder */}
      <div className="rounded-xl border border-edge bg-panel p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted">Jurisdiction preset:</span>
          {JURISDICTIONS.map((j) => (
            <button key={j.id} onClick={() => applyJurisdiction(j.frameworks)} className={`${chip} border border-edge text-muted hover:text-fg`}>
              {j.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-muted">Mesh:</span>
          {effective.map((f) => {
            const on = selectedIds.includes(f.id);
            return (
              <button key={f.id} onClick={() => toggle(f.id)} className={`${chip} border ${on ? "border-fg/40 bg-fg/10 text-fg" : "border-edge text-muted hover:text-fg"}`} title={f.name}>
                {on ? "✓ " : ""}{f.shortName}
                {f.custom ? " ·custom" : ""}
              </button>
            );
          })}
          <span className="ml-1 text-[11px] text-muted">{busy ? "· evaluating…" : `· ${selectedIds.length} frameworks meshed`}</span>
        </div>
      </div>

      {/* portfolio posture */}
      {result ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-edge bg-panel p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted">Portfolio posture</div>
              <div className="mt-0.5"><span className={`${chip} ${POSTURE[result.portfolio.status]}`}>{result.portfolio.status.toUpperCase()}</span></div>
            </div>
            <Kpi label="Agents breaching" value={result.portfolio.breach} tone="bad" />
            <Kpi label="Agents with gaps" value={result.portfolio.gaps} tone="warn" />
            <Kpi label="Fully compliant" value={result.portfolio.compliant} tone="ok" />
          </div>

          {/* per-agent posture */}
          <div className="space-y-2">
            {agentsSorted.map((a) => (
              <div key={a.agentId} className="rounded-xl border border-edge bg-panel">
                <button onClick={() => setOpenAgent(openAgent === a.agentId ? "" : a.agentId)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                  <span className={`h-2 w-2 rounded-full ${DOT[a.status]}`} />
                  <span className="text-[13px] font-semibold text-fg">{a.agentName}</span>
                  <span className={`${chip} ${POSTURE[a.status]}`}>{a.status.toUpperCase()}</span>
                  <span className="ml-auto flex items-center gap-2 text-[11px] text-muted">
                    <span className="text-bad">{a.counts.breach} breach</span>
                    <span className="text-warn">{a.counts.gap} gap</span>
                    <span className="text-ok">{a.counts.compliant} ok</span>
                    <span>{a.counts.manual} manual</span>
                    <span className="text-fg">{a.score}%</span>
                  </span>
                </button>
                {openAgent === a.agentId ? (
                  <div className="border-t border-edge px-3 py-2">
                    <div className="space-y-1">
                      {a.results
                        .slice()
                        .sort((x, y) => rankReq(y.status) - rankReq(x.status))
                        .map((r) => (
                          <div key={`${r.frameworkShort}:${r.requirementId}`} className="flex items-start gap-2 text-[11.5px]">
                            <span className={`${chip} ${REQ[r.status]} shrink-0`}>{r.status}</span>
                            <span className={`${chip} bg-ink text-muted shrink-0`}>{r.frameworkShort}</span>
                            <span className="min-w-0"><span className="text-fg">{r.title}</span> <span className="text-muted">— {r.rationale}</span></span>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* jurisdiction comparison matrix */}
          <div className="overflow-x-auto rounded-xl border border-edge">
            <table className="w-full min-w-[760px] text-[12px]">
              <thead className="bg-panel2 text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Agent → jurisdiction</th>
                  {result.matrix.map((j) => (
                    <th key={j.id} className="px-3 py-2 text-center">
                      {j.label}
                      <div className="font-normal normal-case text-muted">{j.region} · {j.frameworks.length} fw</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.meshed.map((a) => (
                  <tr key={a.agentId} className="border-t border-edge">
                    <td className="px-3 py-2 text-fg">{a.agentName}</td>
                    {result.matrix.map((j) => {
                      const s = j.perAgent.find((p) => p.id === a.agentId)?.status ?? "compliant";
                      return (
                        <td key={j.id} className="px-3 py-2 text-center">
                          <span className={`${chip} ${POSTURE[s]}`}>{s === "compliant" ? "OK" : s === "gaps" ? "GAPS" : "BREACH"}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t border-edge bg-panel2">
                  <td className="px-3 py-2 font-semibold text-fg">Franchise posture</td>
                  {result.matrix.map((j) => (
                    <td key={j.id} className="px-3 py-2 text-center">
                      <span className={`${chip} ${POSTURE[j.status]}`}>{j.status.toUpperCase()}</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-[13px] text-muted">Select frameworks to evaluate…</p>
      )}
    </div>
  );
}

function rank(s: Status) {
  return s === "breach" ? 2 : s === "gaps" ? 1 : 0;
}
function rankReq(s: ReqStatus) {
  return s === "breach" ? 3 : s === "gap" ? 2 : s === "manual" ? 1 : 0;
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
