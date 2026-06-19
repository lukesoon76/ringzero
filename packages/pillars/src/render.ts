/**
 * Render an attestation as a clean, self-contained HTML document with replay
 * links back into the console trace viewer. (HTML chosen over PDF for the demo;
 * print-to-PDF from the browser produces the auditor artifact.)
 */

import type { Attestation } from "./attestation.js";

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

export interface RenderOptions {
  /** Base URL of the console trace viewer; replay links are `${base}?run=…&step=…`. */
  readonly traceViewerBase?: string;
}

export function renderAttestationHtml(att: Attestation, opts: RenderOptions = {}): string {
  const base = opts.traceViewerBase ?? "#/trace";
  const rows = att.controls
    .map((c) => {
      const status = c.satisfied
        ? `<span class="ok">SATISFIED</span>`
        : `<span class="gap">GAP</span>`;
      const evidence = c.evidence
        ? `<a href="${esc(base)}?run=${encodeURIComponent(att.runId)}&step=${c.evidence.stepIndex}">step ${c.evidence.stepIndex}</a> — ${esc(c.evidence.detail)}`
        : `<em>${esc(c.gap ?? "")}</em>`;
      return `<tr><td>${esc(c.standard)}</td><td>${esc(c.title)}</td><td>${status}</td><td>${evidence}</td></tr>`;
    })
    .join("\n");

  const gapsBlock =
    att.gaps.length === 0
      ? `<p class="ok">No gaps — all mapped controls resolve to a real trace event.</p>`
      : `<ul class="gaps">${att.gaps.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Ring Zero attestation — ${esc(att.useCase)}</title>
<style>
  :root { color-scheme: dark; }
  body { background:#0b0f14; color:#d7e0ea; font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; margin:0; padding:32px; }
  h1 { font-size:18px; margin:0 0 4px; } .sub { color:#7d8aa0; margin:0 0 20px; }
  .meta { display:flex; gap:24px; margin-bottom:20px; flex-wrap:wrap; }
  .meta div { background:#121826; border:1px solid #1f2a3a; border-radius:8px; padding:8px 12px; }
  .meta b { color:#9fb3c8; font-weight:600; }
  table { width:100%; border-collapse:collapse; }
  th,td { text-align:left; padding:8px 10px; border-bottom:1px solid #1f2a3a; vertical-align:top; }
  th { color:#7d8aa0; font-weight:600; text-transform:uppercase; font-size:11px; letter-spacing:.05em; }
  .ok { color:#3ad29f; font-weight:600; } .gap { color:#ff6b6b; font-weight:600; }
  a { color:#5aa9ff; } .gaps { color:#ff9d6b; }
  footer { margin-top:24px; color:#56627a; font-size:12px; }
</style></head>
<body>
  <h1>Ring Zero — Compliance Attestation</h1>
  <p class="sub">Use case: ${esc(att.useCase)} · generated from ${esc(att.generatedFrom)}</p>
  <div class="meta">
    <div><b>Run</b> ${esc(att.runId)}</div>
    <div><b>Risk tier</b> ${att.tier}</div>
    <div><b>Terminal</b> ${esc(att.terminal.kind)}</div>
    <div><b>Controls satisfied</b> ${att.controls.filter((c) => c.satisfied).length}/${att.controls.length}</div>
  </div>
  <table>
    <thead><tr><th>Standard</th><th>Control</th><th>Status</th><th>Evidence (replayable)</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h2 style="font-size:14px;margin-top:24px">Gaps</h2>
  ${gapsBlock}
  <footer>Every satisfied control resolves to a real, replayable trace event. Gaps are reported, never asserted satisfied.</footer>
</body></html>`;
}
