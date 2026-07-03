"use client";

import { useEffect, useMemo, useState } from "react";

interface RiskSignals {
  agency: number;
  authority: number;
  impact: number;
  exposure: number;
  recoverability: number;
}
interface ThirdParty {
  provider: string;
  contract?: string;
}
interface AgentManifest {
  id: string;
  name: string;
  source: string;
  owner: string;
  purpose: string;
  skills: string[];
  dataCategories: string[];
  lifecycleStage: string;
  materiality: { tierRationale: string };
  thirdParty?: ThirdParty;
  tools: { id: string; intent: string }[];
  models: string[];
  autonomy: { canDispatchExternally: boolean; scopes: string[] };
  enforcement: { mode: string; bindable: boolean; via: string };
  runtime: { platform: string; region?: string; tenant?: string };
  riskSignals: RiskSignals;
}
interface ModelManifest {
  id: string;
  name: string;
  kind: string;
  provider: string;
  hostedOn: string;
  owner: string;
  purpose: string;
  dataCategories: string[];
  lifecycleStage: string;
  thirdParty?: ThirdParty;
  riskSignals: RiskSignals;
  usedByAgents: string[];
}

type AssetType = "agent" | "model";
interface AssetRow {
  id: string;
  type: AssetType;
  name: string;
  subtype: string;
  providerOrSource: string;
  owner: string;
  purpose: string;
  lifecycle: string;
  tier: number;
  materiality: string;
  data: string[];
  access: string;
  thirdParty?: string;
  enforcement?: string;
  raw: AgentManifest | ModelManifest;
}

const SOURCE_LABEL: Record<string, string> = {
  "aws-bedrock": "AWS Bedrock",
  "azure-ai-agents": "Azure AI",
  "salesforce-agentforce": "Salesforce",
  "sap-joule": "SAP Joule",
  "code-scan": "Code scan",
  "otel-egress": "OTel egress",
};
const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";
const STORE_GOV = "regent-discovery-triage";

function tier(r: RiskSignals) {
  const t = r.agency + r.authority + r.impact + r.exposure + r.recoverability;
  return t <= 3 ? 1 : t <= 7 ? 2 : t <= 11 ? 3 : 4;
}
function assessed(lifecycle: string, materiality: string) {
  return lifecycle !== "intake" && !materiality.toLowerCase().startsWith("unassessed");
}

export default function InventoryPage() {
  const [agents, setAgents] = useState<AgentManifest[]>([]);
  const [models, setModels] = useState<ModelManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | AssetType>("all");
  const [query, setQuery] = useState("");
  const [governed, setGoverned] = useState<Record<string, string>>({});
  const [sweptAt, setSweptAt] = useState<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_GOV);
      if (raw) setGoverned(JSON.parse(raw) as Record<string, string>);
    } catch {
      /* ignore */
    }
    void (async () => {
      const json = (await (await fetch("/api/inventory")).json()) as { agents: AgentManifest[]; models: ModelManifest[] };
      setAgents(json.agents ?? []);
      setModels(json.models ?? []);
      setSweptAt(new Date().toLocaleString());
      setLoading(false);
    })();
  }, []);

  const rows: AssetRow[] = useMemo(() => {
    const a: AssetRow[] = agents.map((m) => ({
      id: m.id,
      type: "agent",
      name: m.name,
      subtype: SOURCE_LABEL[m.source] ?? m.source,
      providerOrSource: m.runtime.platform,
      owner: m.owner,
      purpose: m.purpose,
      lifecycle: m.lifecycleStage,
      tier: tier(m.riskSignals),
      materiality: m.materiality.tierRationale,
      data: m.dataCategories,
      access: [...m.skills, ...m.autonomy.scopes].join(", ") || "—",
      thirdParty: m.thirdParty?.provider,
      enforcement: m.enforcement.mode,
      raw: m,
    }));
    const md: AssetRow[] = models.map((m) => ({
      id: m.id,
      type: "model",
      name: m.name,
      subtype: m.kind,
      providerOrSource: `${m.provider} · ${m.hostedOn}`,
      owner: m.owner,
      purpose: m.purpose,
      lifecycle: m.lifecycleStage,
      tier: tier(m.riskSignals),
      materiality: m.thirdParty ? "Third-party foundation model" : "In-house model",
      data: m.dataCategories,
      access: m.usedByAgents.length ? `used by ${m.usedByAgents.length} agent(s)` : "unused",
      thirdParty: m.thirdParty?.provider,
      raw: m,
    }));
    return [...a, ...md];
  }, [agents, models]);

  const shown = rows.filter((r) => (typeFilter === "all" || r.type === typeFilter) && (!query || (r.name + r.owner + r.purpose + r.subtype).toLowerCase().includes(query.toLowerCase())));

  const total = rows.length;
  const withOwner = rows.filter((r) => r.owner && r.owner !== "Unassigned").length;
  const materialityAssessed = rows.filter((r) => assessed(r.lifecycle, r.materiality)).length;
  const thirdPartyCount = rows.filter((r) => r.thirdParty).length;
  const governedAgents = agents.filter((m) => governed[m.id] === "governed").length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  function exportInventory() {
    const payload = {
      schema: "regent/ai-asset-inventory/v1",
      generatedAt: sweptAt,
      framework: "MAS Guidelines on AI Risk Management",
      completeness: {
        totalAssets: total,
        agents: agents.length,
        models: models.length,
        withOwnerPct: pct(withOwner),
        materialityAssessedPct: pct(materialityAssessed),
        thirdPartyPct: pct(thirdPartyCount),
        governedAgents,
      },
      assets: rows.map(({ raw: _raw, ...r }) => r),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "regent-ai-asset-inventory.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-fg">AI Asset Inventory</h1>
          <p className="max-w-3xl text-[13px] text-muted">
            A current, materiality-tiered inventory of every AI asset — agents, workflows, skills, tools access, and models
            — normalised from all platforms under one control plane. Aligned to the <span className="text-fg">MAS Guidelines
            on AI Risk Management</span> (identification, materiality, third-party, lifecycle).
          </p>
        </div>
        <button onClick={exportInventory} className="rounded-lg border border-edge px-3 py-1.5 text-[12px] text-fg hover:bg-panel2">↓ export inventory (JSON)</button>
      </div>

      {/* completeness & currency */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="AI assets" value={`${total}`} sub={`${agents.length} agents · ${models.length} models`} />
        <Stat label="Owned" value={`${pct(withOwner)}%`} tone={pct(withOwner) === 100 ? "ok" : "warn"} />
        <Stat label="Materiality assessed" value={`${pct(materialityAssessed)}%`} tone={pct(materialityAssessed) >= 90 ? "ok" : "warn"} />
        <Stat label="Third-party AI" value={`${thirdPartyCount}`} />
        <Stat label="Governed agents" value={`${governedAgents}/${agents.length}`} tone="ok" />
        <Stat label="Last swept" value="just now" sub={sweptAt} />
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "agent", "model"] as const).map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`${chip} border ${typeFilter === t ? "border-fg/40 bg-fg/10 text-fg" : "border-edge text-muted hover:text-fg"}`}>
            {t === "all" ? "all assets" : `${t}s`}
          </button>
        ))}
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assets…" className="w-56 rounded-lg border border-edge bg-ink px-3 py-1 text-[12px] text-fg outline-none focus:border-fg/40" />
      </div>

      {loading ? (
        <p className="text-[13px] text-muted">Compiling inventory…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full min-w-[1000px] text-[12px]">
            <thead className="bg-panel2 text-[10px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Asset</th>
                <th className="px-3 py-2 text-left">Provider / runtime</th>
                <th className="px-3 py-2 text-left">Owner</th>
                <th className="px-3 py-2 text-left">Lifecycle</th>
                <th className="px-3 py-2 text-left">Materiality</th>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Access / skills</th>
                <th className="px-3 py-2 text-left">Third-party</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-t border-edge align-top">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`${chip} ${r.type === "agent" ? "bg-brand/20 text-fg" : "bg-ink text-muted"}`}>{r.type}</span>
                      <span className="font-semibold text-fg">{r.name}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">{r.subtype} · {r.purpose}</div>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{r.providerOrSource}</td>
                  <td className="px-3 py-2.5 text-muted">{r.owner}</td>
                  <td className="px-3 py-2.5"><span className={`${chip} bg-ink ${r.lifecycle === "deployed" ? "text-ok" : r.lifecycle === "intake" ? "text-warn" : "text-muted"}`}>{r.lifecycle}</span></td>
                  <td className="px-3 py-2.5">
                    <span className={`${chip} bg-ink text-fg`} title={r.materiality}>Tier {r.tier}</span>
                    <div className="mt-0.5 max-w-[220px] text-[10.5px] leading-tight text-muted">{r.materiality}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">{r.data.map((d) => <span key={d} className={`${chip} bg-ink text-muted`}>{d}</span>)}</div>
                  </td>
                  <td className="px-3 py-2.5 text-muted">
                    {r.access}
                    {r.enforcement ? <div className="mt-0.5"><span className={`${chip} ${r.enforcement === "inline" ? "bg-ok/15 text-ok" : r.enforcement === "native" ? "bg-warn/15 text-warn" : "bg-edge text-muted"}`}>{r.enforcement}</span></div> : null}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{r.thirdParty ?? <span className="text-muted">in-house</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-fg";
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold tabular-nums ${color}`}>{value}</div>
      {sub ? <div className="truncate text-[10px] text-muted">{sub}</div> : null}
    </div>
  );
}
