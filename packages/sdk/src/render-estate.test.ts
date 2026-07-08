import { describe, expect, it } from "vitest";
import { discoverAll, discoverModels } from "./connectors.js";
import { combineInventory } from "./inventory-attestation.js";
import { renderEstateMatrixHtml } from "./render-estate.js";

const estate = combineInventory(discoverAll(), discoverModels());
const html = renderEstateMatrixHtml(estate, { title: "Estate", generatedAt: "2026-07-03" });

describe("estate matrix HTML export (P6 auditor artifact)", () => {
  it("is a self-contained HTML document", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Regent — Estate");
    expect(html).not.toMatch(/https?:\/\//); // no external assets — CSP-safe/print-ready
  });

  it("renders the estate coverage and the four verdict tallies", () => {
    expect(html).toContain(`${estate.coveragePct}%`);
    expect(html).toContain(">Binding<");
    expect(html).toContain(">Unverified<");
    expect(html).toContain(">Shadow<");
    expect(html).toContain(">Gap<");
  });

  it("groups the matrix into Agents and Models sections", () => {
    expect(html).toContain(">Agents<");
    expect(html).toContain(">Models<");
  });

  it("surfaces at least one open finding when the estate is not fully binding", () => {
    const nonBinding = estate.combined.some((c) => c.verdict !== "binding");
    expect(nonBinding).toBe(true);
    expect(html).toContain("Open findings");
  });

  it("escapes to avoid HTML injection from asset names", () => {
    const injected = renderEstateMatrixHtml({
      ...estate,
      combined: estate.combined.map((c, i) => (i === 0 ? { ...c, assetName: '<script>"x"</script>' } : c)),
    });
    expect(injected).toContain("&lt;script&gt;");
    expect(injected).not.toContain("<script>");
  });
});
