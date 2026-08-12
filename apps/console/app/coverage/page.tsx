import { attestAutonomy, discoverAll } from "@ring-zero/sdk";
import { Panel, StanceBadge } from "../../components/ui";
import { PILLARS, STANDARDS } from "../../lib/pillars";

export const dynamic = "force-dynamic";

export default function CoveragePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-bold text-fg">Frameworks & pillar coverage</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-muted">
          The 8-pillar governance board as a product surface. Regent owns the white space — P4, deterministic
          runtime enforcement — and integrates the rest. We enter from the execution layer that data-governance vendors
          reach up to and GRC vendors push down to, but neither enforces deterministically.
        </p>
      </header>

      <Panel title="Governance pillars — 1 owned deep (P4), 1 owned narrow (P3), 6 thin-but-real">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Pillar</th>
              <th className="py-2 pr-3">Build</th>
              <th className="py-2 pr-3">Position</th>
              <th className="py-2 pr-3">Function</th>
              <th className="py-2">Incumbents</th>
            </tr>
          </thead>
          <tbody>
            {PILLARS.map((p) => {
              const wedge = p.id === "P4";
              return (
                <tr key={p.id} className={`border-t border-edge ${wedge ? "bg-brand/10" : ""}`}>
                  <td className="py-2 pr-3 text-muted">{p.id}</td>
                  <td className={`py-2 pr-3 ${wedge ? "font-semibold text-fg" : "text-fg"}`}>{p.name}</td>
                  <td className="py-2 pr-3">
                    <StanceBadge stance={p.stance} />
                  </td>
                  <td className={`py-2 pr-3 ${wedge ? "text-brand" : "text-muted"}`}>{p.owns}</td>
                  <td className="py-2 pr-3 text-muted">{p.fn}</td>
                  <td className="py-2 text-muted">{p.incumbents}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <Panel title="Why the white space matters — live from your estate">
        {(() => {
          const auto = attestAutonomy(discoverAll());
          const criticals = auto.agents.filter((a) => a.severity === "critical").length;
          return (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr] md:items-center">
              <div className="flex gap-5">
                <div>
                  <div className="text-[22px] font-bold tabular-nums text-bad">{criticals}</div>
                  <div className="max-w-[132px] text-[11px] leading-snug text-muted">high-autonomy agents under-governed</div>
                </div>
                <div>
                  <div className="text-[22px] font-bold tabular-nums text-fg">{auto.summary.conforming}/{auto.summary.total}</div>
                  <div className="max-w-[132px] text-[11px] leading-snug text-muted">conform to their autonomy level</div>
                </div>
              </div>
              <p className="text-[13px] text-muted">
                The L1–L5 agent-safety standard says safeguards must match autonomy. Across the discovered estate,{" "}
                <span className="text-bad">{criticals}</span> agents run at L4+ (a human out of the loop) with only
                advisory/detective controls — the &ldquo;high-autonomy, high-privilege deployment is a critical risk
                environment&rdquo; failure the frontier-safety frameworks name. Frameworks and monitors{" "}
                <span className="text-fg">describe</span> this; only Regent (P4) makes the safeguard{" "}
                <span className="text-fg">binding</span>.{" "}
                <a href="/autonomy" className="text-link">See the conformance board →</a>
              </p>
            </div>
          );
        })()}
      </Panel>

      <Panel title="Standards in scope">
        <div className="flex flex-wrap gap-2">
          {STANDARDS.map((s) => (
            <span key={s} className="rounded border border-edge px-2 py-1 text-xs text-muted">
              {s}
            </span>
          ))}
        </div>
      </Panel>
    </div>
  );
}
