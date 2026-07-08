/**
 * Static, self-contained HTML export of the ESTATE attestation matrix — the
 * declared x exercised fusion over every discovered agent + model on one page.
 *
 * Sibling to @ring-zero/pillars renderAttestationHtml (which renders the
 * per-use-case run attestation): same dark, print-first aesthetic. The console's
 * AttestationView is the interactive surface; THIS is the portable artifact —
 * print-to-PDF from the browser yields the auditor/regulator deliverable for the
 * whole estate, not a single run.
 *
 * Pure string builder: no clock, no DOM, no external assets (CSP-safe, inlined).
 * A cell is only "binding" (strongest evidence) when a deterministic control is
 * both DECLARED and EXERCISED; advisory/unverified/shadow are shown, never
 * counted as a pass — the honesty is the point.
 */

import type { EstateAttestation, CombinedCell, Verdict } from "./inventory-attestation.js";

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

/** Composite map key. Asset ids and control ids never contain "::". */
const rowKey = (asset: string, control: string): string => `${asset}::${control}`;

export interface EstateRenderOptions {
  /** Base URL of the console; asset links become `${base}?asset=…`. */
  readonly consoleBase?: string;
  readonly title?: string;
  /** ISO timestamp for the footer — caller-supplied (no clock in this module). */
  readonly generatedAt?: string;
}

/** Glyphs are HTML numeric entities so this source stays pure ASCII. */
const VERDICT_META: Record<Verdict | "na", { glyph: string; label: string; cls: string }> = {
  binding: { glyph: "&#9679;", label: "Binding", cls: "v-binding" }, // filled circle
  unverified: { glyph: "&#9680;", label: "Unverified", cls: "v-unverified" }, // half circle
  shadow: { glyph: "&#9671;", label: "Shadow", cls: "v-shadow" }, // hollow diamond
  gap: { glyph: "&#10007;", label: "Gap", cls: "v-gap" }, // ballot X
  na: { glyph: "&#183;", label: "N/A", cls: "v-na" }, // middle dot
};

/** Findings order: gap -> shadow -> unverified (binding is not a finding). */
const FINDING_RANK: Record<Verdict, number> = { gap: 0, shadow: 1, unverified: 2, binding: 9 };
const SEV_RANK: Record<CombinedCell["severity"], number> = { critical: 0, high: 1, medium: 2 };
const covClass = (pct: number) => (pct >= 80 ? "cov-good" : pct >= 50 ? "cov-warn" : "cov-bad");

export function renderEstateMatrixHtml(estate: EstateAttestation, opts: EstateRenderOptions = {}): string {
  const base = opts.consoleBase ?? "#/inventory";
  const title = opts.title ?? "AI Asset Estate — Compliance Attestation";
  const cells = estate.combined;

  // columns: unique controls in first-seen order, tagged with standard + title
  const columns: Array<{ controlId: string; standard: string; title: string }> = [];
  const seenCol = new Set<string>();
  for (const c of cells) {
    if (!seenCol.has(c.controlId)) {
      seenCol.add(c.controlId);
      columns.push({ controlId: c.controlId, standard: c.standard, title: c.title });
    }
  }
  const standardGroups: Array<{ standard: string; span: number }> = [];
  for (const col of columns) {
    const last = standardGroups[standardGroups.length - 1];
    if (last && last.standard === col.standard) last.span += 1;
    else standardGroups.push({ standard: col.standard, span: 1 });
  }

  // rows: assets grouped agents -> models, first-seen order within class
  const assetOrder: Array<{ id: string; name: string; cls: "agent" | "model" }> = [];
  const seenAsset = new Set<string>();
  for (const c of cells) {
    if (!seenAsset.has(c.asset)) {
      seenAsset.add(c.asset);
      assetOrder.push({ id: c.asset, name: c.assetName, cls: c.assetClass });
    }
  }
  assetOrder.sort((a, b) => (a.cls === b.cls ? 0 : a.cls === "agent" ? -1 : 1));

  const cellOf = new Map<string, CombinedCell>();
  for (const c of cells) cellOf.set(rowKey(c.asset, c.controlId), c);

  const headTop =
    `<tr><th class="rowhead" rowspan="2">Asset</th>` +
    standardGroups.map((g) => `<th class="grp" colspan="${g.span}">${esc(g.standard)}</th>`).join("") +
    `<th class="rowhead" rowspan="2">Binding</th></tr>`;
  const headBot = `<tr>` + columns.map((col) => `<th class="ctl" title="${esc(col.controlId)}">${esc(col.title)}</th>`).join("") + `</tr>`;

  let lastClass: "agent" | "model" | null = null;
  const bodyRows = assetOrder
    .map((a) => {
      const rowCells = columns.map((col) => {
        const c = cellOf.get(rowKey(a.id, col.controlId));
        const key = c ? c.verdict : "na";
        const m = VERDICT_META[key];
        const tip = c ? `${c.standard} · ${m.label.toUpperCase()} — ${c.detail}` : "not applicable to this asset class";
        return `<td class="cell ${m.cls}" title="${esc(tip)}">${m.glyph}</td>`;
      });
      const applicable = columns.filter((col) => cellOf.has(rowKey(a.id, col.controlId)));
      const binding = applicable.filter((col) => cellOf.get(rowKey(a.id, col.controlId))!.verdict === "binding").length;
      const rowPct = applicable.length === 0 ? 0 : Math.round((binding / applicable.length) * 100);
      const groupHeader =
        a.cls !== lastClass ? ((lastClass = a.cls), `<tr class="classrow"><td colspan="${columns.length + 2}">${a.cls === "agent" ? "Agents" : "Models"}</td></tr>`) : "";
      const link = `<a href="${esc(base)}?asset=${encodeURIComponent(a.id)}">${esc(a.name)}</a>`;
      return `${groupHeader}<tr><td class="asset">${link}<span class="aid">${esc(a.id)}</span></td>${rowCells.join("")}<td class="rowcov ${covClass(rowPct)}">${rowPct}%</td></tr>`;
    })
    .join("\n");

  const rollup = estate.byStandard
    .map(
      (s) =>
        `<div class="bar"><span class="barlabel">${esc(s.standard)}</span>` +
        `<span class="track"><span class="fill ${covClass(s.coveragePct)}" style="width:${s.coveragePct}%"></span></span>` +
        `<span class="barpct ${covClass(s.coveragePct)}">${s.coveragePct}%</span><span class="barnum">${s.covered}/${s.applicable}</span></div>`,
    )
    .join("");

  const findings = estate.combined
    .filter((c) => c.verdict !== "binding")
    .sort((x, y) => FINDING_RANK[x.verdict] - FINDING_RANK[y.verdict] || SEV_RANK[x.severity] - SEV_RANK[y.severity] || x.asset.localeCompare(y.asset));
  const findingsBlock =
    findings.length === 0
      ? `<p class="ok">No open findings — every applicable control is deterministically declared AND exercised.</p>`
      : `<ul class="gaps">${findings
          .map((g) => {
            const m = VERDICT_META[g.verdict];
            return `<li class="sev-${g.severity}"><span class="tag ${m.cls}">${m.label.toUpperCase()}</span> <b>${esc(g.assetName)}</b> — ${esc(g.standard)}: ${esc(g.title)}<br><span class="gapdetail">${esc(g.detail)}</span></li>`;
          })
          .join("")}</ul>`;

  const v = estate.verdicts;
  const legend = (["binding", "unverified", "shadow", "gap", "na"] as const)
    .map((k) => `<span class="lg"><span class="cell ${VERDICT_META[k].cls}">${VERDICT_META[k].glyph}</span> ${VERDICT_META[k].label}</span>`)
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Regent — ${esc(title)}</title>
<style>
  :root { color-scheme: dark; }
  body { background:#0b0f14; color:#d7e0ea; font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; margin:0; padding:32px; }
  h1 { font-size:18px; margin:0 0 4px; } .sub { color:#7d8aa0; margin:0 0 20px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:#7d8aa0; margin:28px 0 12px; }
  .meta { display:flex; gap:16px; margin-bottom:22px; flex-wrap:wrap; }
  .meta div { background:#121826; border:1px solid #1f2a3a; border-radius:8px; padding:10px 14px; }
  .meta b { color:#9fb3c8; font-weight:600; display:block; font-size:11px; text-transform:uppercase; letter-spacing:.05em; }
  .big { font-size:22px; font-weight:700; }
  .cov-good,.v-binding { color:#3ad29f; } .cov-warn { color:#e0c061; } .cov-bad { color:#ff6b6b; }
  .fill.cov-good { background:#3ad29f; } .fill.cov-warn { background:#e0c061; } .fill.cov-bad { background:#ff6b6b; }
  .bar { display:flex; align-items:center; gap:10px; margin:5px 0; }
  .barlabel { width:230px; color:#9fb3c8; } .barnum { color:#56627a; width:44px; }
  .track { flex:1; height:8px; background:#161d29; border-radius:5px; overflow:hidden; max-width:420px; }
  .fill { display:block; height:100%; } .barpct { width:44px; text-align:right; font-weight:700; }
  .wrap { overflow-x:auto; border:1px solid #1f2a3a; border-radius:10px; }
  table { border-collapse:collapse; width:100%; }
  th,td { padding:7px 9px; border-bottom:1px solid #161d29; text-align:center; white-space:nowrap; }
  th.grp { color:#9fb3c8; border-left:1px solid #1f2a3a; font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
  th.ctl { color:#7d8aa0; font-weight:500; font-size:11px; border-left:1px solid #161d29; }
  th.rowhead { color:#7d8aa0; font-size:11px; text-transform:uppercase; letter-spacing:.05em; }
  td.asset { text-align:left; } td.asset a { color:#5aa9ff; text-decoration:none; }
  .aid { display:block; color:#56627a; font-size:10px; }
  tr.classrow td { text-align:left; color:#9fb3c8; background:#0f1622; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:.08em; padding:5px 9px; }
  .cell { font-size:14px; width:20px; }
  .v-binding { color:#3ad29f; } .v-unverified { color:#e0c061; } .v-shadow { color:#5aa9ff; } .v-gap { color:#ff6b6b; background:#ff6b6b12; } .v-na { color:#33405a; }
  .rowcov { font-weight:700; text-align:right; }
  .legend { display:flex; gap:18px; margin:12px 0 2px; color:#7d8aa0; font-size:12px; } .lg .cell { display:inline; }
  .ok { color:#3ad29f; }
  .gaps { list-style:none; padding:0; max-width:820px; } .gaps li { padding:7px 0 7px 10px; border-left:2px solid; margin:3px 0; }
  .gaps li.sev-critical { border-color:#ff6b6b; } .gaps li.sev-high { border-color:#ff9d6b; } .gaps li.sev-medium { border-color:#e0c061; }
  .tag { font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px; } .tag.v-gap { background:#ff6b6b1a; } .tag.v-shadow { background:#5aa9ff1a; } .tag.v-unverified { background:#e0c0611a; }
  .gapdetail { color:#7d8aa0; } b { color:#d7e0ea; }
  footer { margin-top:26px; color:#56627a; font-size:12px; max-width:820px; }
</style></head>
<body>
  <h1>Regent — ${esc(title)}</h1>
  <p class="sub">Declared x exercised coverage across the discovered AI estate · ${estate.assetCount} assets · ${estate.combined.length} applicable controls</p>

  <div class="meta">
    <div><b>Estate coverage</b><span class="big ${covClass(estate.coveragePct)}">${estate.coveragePct}%</span></div>
    <div><b>Binding</b><span class="big v-binding">${v.binding}</span></div>
    <div><b>Unverified</b><span class="big cov-warn">${v.unverified}</span></div>
    <div><b>Shadow</b><span class="big v-shadow">${v.shadow}</span></div>
    <div><b>Gap</b><span class="big ${v.gap ? "cov-bad" : "cov-good"}">${v.gap}</span></div>
  </div>

  <h2>Coverage by standard (declared)</h2>
  ${rollup}

  <h2>Estate attestation matrix — declared x exercised</h2>
  <div class="legend">${legend}</div>
  <div class="wrap"><table>
    <thead>${headTop}${headBot}</thead>
    <tbody>${bodyRows}</tbody>
  </table></div>

  <h2>Open findings — severity ranked</h2>
  ${findingsBlock}

  <footer>A control is <b>Binding</b> only when a deterministic control is both DECLARED in the inventory and EXERCISED at runtime.
  <b>Unverified</b> = declared but not exercised; <b>Shadow</b> = exercised but not declared; <b>Gap</b> = neither. Advisory/detective coverage is shown, never counted as binding.
  ${opts.generatedAt ? `Generated ${esc(opts.generatedAt)}.` : ""}</footer>
</body></html>`;
}
