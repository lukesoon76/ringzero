import { runTrajectory } from "@ring-zero/kernel";
import { buildCreditMemoPolicy, seedHappyPath, thetaForTier } from "@ring-zero/policy";
import { TelemetryStore } from "@ring-zero/telemetry";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { Registry } from "./registry.js";

const dir = mkdtempSync(join(tmpdir(), "rz-registry-"));
const dbPath = join(dir, "r.db");
const store = new TelemetryStore(dbPath);
store.recordRun(runTrajectory(buildCreditMemoPolicy(), thetaForTier(3), seedHappyPath), {
  runId: "run-1",
  agentId: "memo-agent",
  governed: true,
});
const registry = new Registry(dbPath);

afterAll(() => {
  store.close();
  registry.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("agent registry + agent card (P1)", () => {
  registry.register({
    agentId: "memo-agent",
    name: "Credit-memo agent",
    purpose: "Draft and release a credit memo under governance.",
    owner: "Credit Risk",
    supervisingUser: "risk-officer@bank",
    tier: 4,
    tools: ["extract", "retrieve", "compute", "draft", "release"],
    authorityScopes: ["source:read", "kb:retrieve", "memo:draft", "memo:release"],
    capabilities: ["C1", "C2", "C3", "C4"],
  });

  it("returns an agent card with purpose, capabilities and live trace links", () => {
    const card = registry.getAgentCard("memo-agent");
    expect(card?.purpose).toMatch(/credit memo/i);
    expect(card?.capabilities).toContain("C1");
    expect(card?.traceLinks.map((l) => l.runId)).toContain("run-1");
  });

  it("lists registered agents", () => {
    expect(registry.list().map((a) => a.agentId)).toContain("memo-agent");
  });
});
