"use client";

import { useEffect, useState } from "react";

type Severity = "ok" | "watch" | "critical";
interface ControlCheck {
  kind: string;
  met: boolean;
  boundAs?: string;
}
interface AgentResult {
  agentId: string;
  name: string;
  source: string;
  level: number | null;
  code: string;
  tier: number | null;
  minTier: number | null;
  tierOk: boolean;
  controls: ControlCheck[];
  requiredRedLines: string[];
  conforms: boolean;
  gaps: string[];
  severity: Severity;
}
interface LevelDef {
  level: number;
  code: string;
  name: string;
  humanRole: string;
  description: string;
  minTier: number;
  requiredControls: string[];
  requiredCapabilities: string[];
  requiredRedLines: string[];
}
interface RedLine {
  id: string;
  name: string;
  statement: string;
  enforcedBy: string;
  mechanism: "structural" | "constraint";
}
interface Data {
  agents: AgentResult[];
  levels: LevelDef[];
  redLines: RedLine[];
  summary: { total: number; conforming: number; critical: number; unclassified: number };
}

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";
const SEV: Record<Severity, { cls: string; label: string }> = {
  ok: { cls: "bg-ok/15 text-ok", label: "CONFORMS" },
  watch: { cls: "bg-warn/15 text-warn", label: "UNDER-GOVERNED" },
  critical: { cls: "bg-bad/15 text-bad", label: "CRITICAL" },
};

export default function AutonomyPage() {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    void (async () => setData((await (await fetch("/api/autonomy")).json()) as Data))();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Agent Autonomy (L1–L5) &amp; Red Lines</h1>
        <p className="max-w-3xl text-[13px] text-muted">
          The emerging general-purpose-agent safety standard classifies agents by <span className="text-fg">autonomy</span> and
          prescribes safeguards per level. Regent does what a framework or a monitor cannot: it{" "}
          <span className="text-fg">enforces</span> those safeguards deterministically. Higher autonomy ⇒ stricter binding
          controls and more <span className="text-fg">red lines</span> that must hold. Only deterministic controls count —
          advisory/detective never satisfy a level.
        </p>
      </div>

      {!data ? (
        <p className="text-[13px] text-muted">Projecting autonomy conformance from the inventory…</p>
      ) : (
        <>
          {/* summary */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Agents" value={`${data.summary.total}`} />
            <Kpi label="Conforming" value={`${data.summary.conforming}/${data.summary.total}`} tone={data.summary.conforming === data.summary.total ? "ok" : "warn"} />
            <Kpi label="Critical (high-autonomy, under-governed)" value={`${data.summary.critical}`} tone={data.summary.critical ? "bad" : "ok"} />
            <Kpi label="Unclassified" value={`${data.summary.unclassified}`} tone={data.summary.unclassified ? "warn" : "ok"} />
          </div>

          {/* per-agent conformance */}
          <h2 className="pt-1 text-xs font-semibold uppercase tracking-wider text-muted">Conformance — does enforcement match autonomy?</h2>
          <div className="overflow-x-auto rounded-xl border border-edge">
            <table className="w-full min-w-[760px] text-[12px]">
              <thead className="bg-panel2 text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Agent</th>
                  <th className="px-3 py-2 text-center">Autonomy</th>
                  <th className="px-3 py-2 text-center">Tier</th>
                  <th className="px-3 py-2 text-left">Required controls (deterministic)</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((a) => (
                  <tr key={a.agentId} className="border-t border-edge align-top">
                    <td className="px-3 py-2">
                      <div className="text-fg">{a.name}</div>
                      <div className="font-mono text-[10px] text-muted">{a.source}</div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`${chip} ${a.level === null ? "bg-ink text-muted" : a.level >= 4 ? "bg-link/15 text-link" : "bg-edge/60 text-fg"}`}>{a.code}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {a.tier === null ? <span className="text-muted">—</span> : <span className={a.tierOk ? "text-fg" : "text-bad"}>T{a.tier}{a.minTier ? `/≥${a.minTier}` : ""}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {a.controls.length === 0 ? (
                        <span className="text-muted">{a.level === null ? "classify to evaluate" : "none required"}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {a.controls.map((c) => (
                            <span key={c.kind} className={`${chip} ${c.met ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad"}`} title={c.boundAs ?? "not bound"}>
                              {c.met ? "✓" : "✗"} {c.kind}
                            </span>
                          ))}
                        </div>
                      )}
                      {a.gaps.length > 0 ? <div className="mt-1 text-[11px] text-muted">{a.gaps[0]}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`${chip} ${SEV[a.severity].cls}`}>{a.level === null ? "UNCLASSIFIED" : SEV[a.severity].label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted">
            <span className="text-bad">Critical</span> = an L4/L5 agent (acts with a human out of the loop) whose binding
            controls don&rsquo;t meet its level — the &ldquo;high-autonomy, high-privilege deployment is a critical risk
            environment&rdquo; failure. This is a live projection; classify an agent&rsquo;s autonomy and bind the required
            deterministic controls to clear it.
          </p>

          {/* L1–L5 ladder */}
          <h2 className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted">The L1–L5 ladder — safeguards matched to autonomy</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {data.levels.map((l) => (
              <div key={l.code} className="rounded-xl border border-edge bg-panel p-3">
                <div className="flex items-center justify-between">
                  <span className={`${chip} ${l.level >= 4 ? "bg-link/15 text-link" : "bg-edge/60 text-fg"}`}>{l.code}</span>
                  <span className="text-[10px] text-muted">min Tier {l.minTier}</span>
                </div>
                <div className="mt-1.5 text-[13px] font-semibold text-fg">{l.name}</div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted">{l.humanRole}</p>
                <div className="mt-2 text-[10px] uppercase tracking-wide text-muted">Required controls</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {l.requiredControls.length === 0 && l.requiredCapabilities.length === 0 ? (
                    <span className="text-[11px] text-muted">advisory ok</span>
                  ) : (
                    <>
                      {l.requiredControls.map((c) => <span key={c} className={`${chip} bg-ink text-fg`}>{c}</span>)}
                      {l.requiredCapabilities.map((c) => <span key={c} className={`${chip} bg-link/15 text-link`}>{c}</span>)}
                    </>
                  )}
                </div>
                <div className="mt-1.5 text-[10px] text-muted">{l.requiredRedLines.length} red lines enforced</div>
              </div>
            ))}
          </div>

          {/* red lines */}
          <h2 className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted">Red lines — named prohibitions, enforced not advised</h2>
          <div className="overflow-hidden rounded-xl border border-edge">
            <table className="w-full text-[12px]">
              <thead className="bg-panel2 text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Red line</th>
                  <th className="px-3 py-2 text-left">Prohibition</th>
                  <th className="px-3 py-2 text-left">Enforced by</th>
                  <th className="px-3 py-2 text-center">Mechanism</th>
                </tr>
              </thead>
              <tbody>
                {data.redLines.map((r) => (
                  <tr key={r.id} className="border-t border-edge align-top">
                    <td className="px-3 py-2 text-fg">{r.name}</td>
                    <td className="px-3 py-2 text-muted">{r.statement}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted">{r.enforcedBy}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`${chip} ${r.mechanism === "structural" ? "bg-ok/15 text-ok" : "bg-link/15 text-link"}`}>
                        {r.mechanism === "structural" ? "structural · impossible" : "fail-closed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted">
            <span className="text-ok">Structural</span> red lines are impossible by construction — δ is a total function over the
            closed action set Π, so an undefined transition cannot fire (not flagged after the fact). <span className="text-link">Fail-closed</span> red
            lines are kernel constraints that deny on unknown/missing. Neither is an advisory signal.
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  const c = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-fg";
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 text-[18px] font-semibold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}
