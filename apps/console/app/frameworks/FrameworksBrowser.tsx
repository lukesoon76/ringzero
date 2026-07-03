"use client";

import { useEffect, useMemo, useState } from "react";
import {
  clearOverride,
  getEffective,
  getUserPacks,
  parsePack,
  saveOverride,
  saveUserPacks,
  type Pack,
  type Requirement,
} from "../../lib/frameworks-store";

// kept for the server page's import
export type FrameworkPack = Pack;

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";
const statusCls = (s?: string) =>
  s === "In force" ? "bg-ok/15 text-ok" : s === "Phased" ? "bg-warn/15 text-warn" : s === "Custom" ? "bg-brand/20 text-fg" : "bg-fg/10 text-muted";
const SEV_CLS: Record<Requirement["severity"], string> = {
  critical: "bg-bad/15 text-bad",
  high: "bg-warn/15 text-warn",
  medium: "bg-fg/10 text-muted",
};
const INSTALLED = "rz-installed-frameworks";

function download(pack: Pack) {
  const blob = new Blob([JSON.stringify({ schema: "regent/framework-pack/v1", source: "Regent Governance Studio", ...pack }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${pack.id}.framework.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function FrameworksBrowser({ packs }: { packs: Pack[] }) {
  const [all, setAll] = useState<Pack[]>(packs);
  const [query, setQuery] = useState("");
  const [installed, setInstalled] = useState<string[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadText, setUploadText] = useState("");
  const [uploadErr, setUploadErr] = useState("");
  const [editing, setEditing] = useState<string>("");
  const [draft, setDraft] = useState<Requirement[]>([]);

  const refresh = () => setAll(getEffective(packs));
  useEffect(() => {
    try {
      const raw = localStorage.getItem(INSTALLED);
      if (raw) setInstalled(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packs]);

  const persistInstalled = (next: string[]) => {
    setInstalled(next);
    try {
      localStorage.setItem(INSTALLED, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  const toggleInstall = (id: string) => persistInstalled(installed.includes(id) ? installed.filter((x) => x !== id) : [...installed, id]);

  const addUpload = () => {
    const res = parsePack(uploadText);
    if (typeof res === "string") {
      setUploadErr(res);
      return;
    }
    saveUserPacks([...getUserPacks().filter((p) => p.id !== res.id), res]);
    setUploadText("");
    setUploadErr("");
    setUploadOpen(false);
    refresh();
  };

  const startEdit = (p: Pack) => {
    setEditing(p.id);
    setDraft(p.requirements.map((r) => ({ ...r })));
    setOpen((o) => ({ ...o, [p.id]: true }));
  };
  const saveEdit = (p: Pack) => {
    if (p.custom) {
      saveUserPacks(getUserPacks().map((u) => (u.id === p.id ? { ...u, requirements: draft } : u)));
    } else {
      saveOverride(p.id, draft);
    }
    setEditing("");
    refresh();
  };
  const resetTaxonomy = (id: string) => {
    clearOverride(id);
    setEditing("");
    refresh();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((p) => !q || [p.name, p.shortName, p.jurisdiction, p.authority, ...(p.tags ?? [])].join(" ").toLowerCase().includes(q));
  }, [all, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-fg">Governance Frameworks</h1>
          <p className="max-w-3xl text-[13px] text-muted">
            Upload, install, and <span className="text-fg">edit the taxonomy</span> of any AI-governance framework. Frameworks
            are data — edits here flow straight into the Compliance posture.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setUploadOpen((v) => !v)} className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-ink">+ Upload framework</button>
          <div className="text-right text-[12px] text-muted"><span className="text-fg">{all.length}</span> frameworks</div>
        </div>
      </div>

      {uploadOpen ? (
        <div className="rounded-xl border border-edge bg-panel p-4">
          <div className="mb-2 text-[12px] text-muted">Paste a framework pack (JSON) — <code className="text-fg">{`{ id, name, shortName, requirements:[{ id, title, text, severity }] }`}</code>. Download any framework as a template.</div>
          <textarea value={uploadText} onChange={(e) => setUploadText(e.target.value)} spellCheck={false} placeholder='{"id":"my-fw","name":"My Framework","shortName":"MyFW","requirements":[{"id":"r1","title":"Do X","text":"…","severity":"high"}]}' className="h-40 w-full resize-none rounded-lg border border-edge bg-ink p-3 font-mono text-[12px] text-fg outline-none focus:border-fg/40" />
          {uploadErr ? <div className="mt-2 text-[12px] text-bad">Invalid: {uploadErr}</div> : null}
          <div className="mt-2 flex gap-2">
            <button onClick={addUpload} className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-ink">Add framework</button>
            <button onClick={() => { setUploadOpen(false); setUploadErr(""); }} className="rounded-lg border border-edge px-3 py-1.5 text-[12px] text-muted hover:text-fg">Cancel</button>
          </div>
        </div>
      ) : null}

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search frameworks…" className="w-72 rounded-lg border border-edge bg-ink px-3 py-1.5 text-[12px] text-fg outline-none focus:border-fg/40" />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => {
          const isInstalled = installed.includes(p.id);
          const isOpen = open[p.id];
          const isEditing = editing === p.id;
          return (
            <div key={p.id} className="flex flex-col rounded-xl border border-edge bg-panel p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="rounded border border-edge bg-ink px-1.5 py-0.5 font-mono text-[11px] text-fg">{p.shortName}</span>
                <span className={`${chip} ${statusCls(p.status)}`}>{p.custom ? "Custom" : p.status}</span>
              </div>
              <h2 className="text-[14px] font-semibold leading-snug text-fg">{p.name}</h2>
              <p className="mt-0.5 text-[11px] text-muted">{p.jurisdiction ?? "—"} · {p.authority ?? "—"} · {p.effective ?? "—"}</p>
              <p className="mt-2 text-[12px] leading-snug text-muted">{p.summary}</p>

              {isEditing ? (
                <div className="mt-3 space-y-2 border-t border-edge pt-3">
                  {draft.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <select value={r.severity} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, severity: e.target.value as Requirement["severity"] } : x)))} className="rounded border border-edge bg-ink px-1 py-1 text-[11px] text-fg">
                        <option value="critical">critical</option>
                        <option value="high">high</option>
                        <option value="medium">medium</option>
                      </select>
                      <input value={r.title} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className="min-w-0 flex-1 rounded border border-edge bg-ink px-2 py-1 text-[11px] text-fg" />
                      <button onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} className="text-[11px] text-muted hover:text-bad">✕</button>
                    </div>
                  ))}
                  <button onClick={() => setDraft((d) => [...d, { id: `r${d.length + 1}`, title: "New requirement", text: "", severity: "high" }])} className="text-[11px] text-muted hover:text-fg">+ add requirement</button>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => saveEdit(p)} className="rounded-lg bg-brand px-2.5 py-1 text-[11px] font-semibold text-ink">Save taxonomy</button>
                    <button onClick={() => setEditing("")} className="rounded-lg border border-edge px-2.5 py-1 text-[11px] text-muted hover:text-fg">Cancel</button>
                    {!p.custom ? <button onClick={() => resetTaxonomy(p.id)} className="ml-auto text-[11px] text-muted hover:text-fg">reset to default</button> : null}
                  </div>
                </div>
              ) : isOpen ? (
                <ul className="mt-3 space-y-2 border-t border-edge pt-3">
                  {p.requirements.map((r) => (
                    <li key={r.id} className="text-[11.5px]">
                      <div className="flex items-center gap-2">
                        <span className={`${chip} ${SEV_CLS[r.severity]}`}>{r.severity}</span>
                        <span className="font-semibold text-fg">{r.title}</span>
                      </div>
                      {r.text ? <p className="mt-0.5 text-muted">{r.text}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                <button onClick={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))} className="rounded-lg border border-edge px-2.5 py-1 text-[11px] text-muted hover:text-fg">{isOpen ? "Hide" : `${p.requirements.length} requirements`}</button>
                <button onClick={() => startEdit(p)} className="rounded-lg border border-edge px-2.5 py-1 text-[11px] text-muted hover:text-fg">edit</button>
                <button onClick={() => download(p)} className="rounded-lg border border-edge px-2.5 py-1 text-[11px] text-fg hover:bg-fg/10">↓</button>
                <button onClick={() => toggleInstall(p.id)} className={`ml-auto rounded-lg px-2.5 py-1 text-[11px] font-semibold ${isInstalled ? "border border-ok/40 bg-ok/10 text-ok" : "bg-brand text-ink"}`}>{isInstalled ? "✓ installed" : "install"}</button>
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 ? <p className="text-[13px] text-muted">No frameworks match your search.</p> : null}
    </div>
  );
}
