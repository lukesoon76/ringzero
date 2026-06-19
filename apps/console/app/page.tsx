import { Panel, StanceBadge } from "../components/ui";
import { PILLARS, STANDARDS } from "../lib/pillars";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-bold text-fg">Ring Zero — Governance Pillar Map</h1>
        <p className="mt-1 max-w-3xl text-muted">
          Every AI-governance vendor today <em>observes</em> agents; almost none can <em>stop</em> one. Ring Zero is
          the deterministic enforcement kernel that makes governance binding at runtime — and turns the same evidence
          into audit-ready compliance.
        </p>
      </header>

      <Panel title="The board — 8 pillars, 1 owned deep (P4), 1 owned narrow (P3), 6 thin-but-real">
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
                <tr key={p.id} className={`border-t border-edge ${wedge ? "bg-ok/5" : ""}`}>
                  <td className="py-2 pr-3 text-muted">{p.id}</td>
                  <td className={`py-2 pr-3 ${wedge ? "font-semibold text-fg" : "text-fg"}`}>{p.name}</td>
                  <td className="py-2 pr-3"><StanceBadge stance={p.stance} /></td>
                  <td className={`py-2 pr-3 ${wedge ? "text-ok" : "text-muted"}`}>{p.owns}</td>
                  <td className="py-2 pr-3 text-muted">{p.fn}</td>
                  <td className="py-2 text-muted">{p.incumbents}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Panel title="Why we win — enter from the middle">
          <p className="text-muted">
            Data-governance vendors (Databricks, Dataiku) reach <em>up</em> from the data layer; GRC vendors (Credo)
            push <em>down</em> from policy. Ring Zero enters from the <span className="text-fg">execution layer</span>{" "}
            both sides assume but neither enforces deterministically — a labelled transition system where prohibited
            transitions are structurally impossible, guards are LLM-free and fail-closed, and the audit trail falls out
            of the same substrate.
          </p>
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
    </div>
  );
}
