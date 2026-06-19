import Link from "next/link";
import { Panel, TerminalBadge } from "../../components/ui";
import { listRuns, loadRun } from "../../lib/db";

export const dynamic = "force-dynamic";

const ATTR_KEYS = ["Alignment", "Verified", "Confidence", "Information", "Length"] as const;

function attrLine(a: Record<string, number>): string {
  return ATTR_KEYS.map((k) => `${k[0]}=${typeof a[k] === "number" ? a[k] : "?"}`).join("  ");
}

export default function TracePage({
  searchParams,
}: {
  searchParams: { run?: string; step?: string };
}) {
  const runs = listRuns();
  if (runs.length === 0) {
    return (
      <Panel>
        <p className="text-muted">
          No governed runs yet. Run <code className="text-fg">pnpm demo</code> to generate them.
        </p>
      </Panel>
    );
  }

  const runId = searchParams.run ?? runs[0]!.runId;
  const detail = loadRun(runId);
  const stepIdx = Number(searchParams.step ?? "0");
  const step = detail?.steps.find((s) => s.index === stepIdx) ?? detail?.steps[0];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-fg">Live Trace Viewer</h1>
        <p className="text-xs text-muted">
          Ungoverned runs leave no governance trace (un-auditable by construction). Every governed decision below is
          deterministic, LLM-free and replayable.
        </p>
      </header>

      <div className="grid grid-cols-[220px_240px_1fr] gap-4">
        {/* Runs */}
        <Panel title="Governed runs">
          <ul className="space-y-1">
            {runs.map((r) => (
              <li key={r.runId}>
                <Link
                  href={`/trace?run=${encodeURIComponent(r.runId)}`}
                  className={`block rounded px-2 py-1 ${r.runId === runId ? "bg-edge text-fg" : "text-muted hover:text-fg"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{r.runId}</span>
                    <TerminalBadge kind={r.terminalKind} />
                  </div>
                  <div className="text-[10px] text-muted">
                    tier {r.tier} · {r.auditable ? "auditable" : "un-auditable"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Steps */}
        <Panel title={`Trajectory — ${runId}`}>
          {detail ? (
            <ol className="space-y-1">
              {detail.steps.map((s) => (
                <li key={s.index}>
                  <Link
                    href={`/trace?run=${encodeURIComponent(runId)}&step=${s.index}`}
                    className={`block rounded px-2 py-1 text-xs ${s.index === step?.index ? "bg-edge text-fg" : "text-muted hover:text-fg"}`}
                  >
                    <span className="text-muted">[{s.index}]</span> {s.actionId}{" "}
                    <span className={s.outcome === "blocked" ? "text-bad" : "text-muted"}>· {s.decision}</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted">run not found</p>
          )}
          {detail ? (
            <p className="mt-3 border-t border-edge pt-2 text-xs">
              Terminal: <TerminalBadge kind={detail.terminalKind} />{" "}
              <span className="text-muted">{detail.terminalDetail}</span>
            </p>
          ) : null}
        </Panel>

        {/* Step detail */}
        <Panel title="Guard decision">
          {step ? (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <Field k="action" v={`${step.actionId} (${step.intent})`} />
                <Field k="transition" v={`${step.fromNode} → ${step.toNode}`} />
                <Field k="decision" v={step.decision} />
                <Field k="outcome" v={step.outcome} highlight={step.outcome === "blocked"} />
              </div>
              <div>
                <div className="text-muted">attributes</div>
                <div className="text-fg">pre&nbsp; {attrLine(step.preAttrs)}</div>
                <div className="text-fg">post {attrLine(step.postAttrs)}</div>
              </div>
              {step.note ? <div className="rounded bg-warn/10 px-2 py-1 text-warn">{step.note}</div> : null}
              <div>
                <div className="mb-1 text-muted">guard evaluations (binding — never advisory)</div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase text-muted">
                      <th className="py-1 pr-2 text-left">guard</th>
                      <th className="py-1 pr-2 text-left">outcome</th>
                      <th className="py-1 pr-2 text-left">score</th>
                      <th className="py-1 pr-2 text-left">θ</th>
                      <th className="py-1 text-left">advisory</th>
                    </tr>
                  </thead>
                  <tbody>
                    {step.guards.map((g, i) => (
                      <tr key={i} className="border-t border-edge">
                        <td className="py-1 pr-2 text-fg">{g.guard}</td>
                        <td className={`py-1 pr-2 ${g.outcome === "fired" ? "text-warn" : "text-muted"}`}>{g.outcome}</td>
                        <td className="py-1 pr-2 text-muted">{g.score ?? "—"}</td>
                        <td className="py-1 pr-2 text-muted">{g.threshold ?? "—"}</td>
                        <td className="py-1 text-muted">{g.advisory ? "yes" : "no"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-muted">select a step</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Field({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted">{k}</div>
      <div className={highlight ? "text-bad" : "text-fg"}>{v}</div>
    </div>
  );
}
