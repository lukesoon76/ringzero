import { runTrajectory } from "@ring-zero/kernel";
import { buildCreditMemoPolicy, seedHappyPath, thetaForTier } from "@ring-zero/policy";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { replaysExactly, TelemetryStore } from "./store.js";

const dir = mkdtempSync(join(tmpdir(), "rz-telemetry-"));
const dbPath = join(dir, "t.db");
const W = buildCreditMemoPolicy();
const trajectory = runTrajectory(W, thetaForTier(3), seedHappyPath);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("telemetry store — record / replay / audit", () => {
  const store = new TelemetryStore(dbPath);
  store.recordRun(trajectory, { runId: "run-happy", agentId: "memo-agent", governed: true });

  it("reconstructs and replays a completed run exactly", () => {
    const reconstructed = store.loadRun("run-happy");
    expect(reconstructed.steps.length).toBe(trajectory.steps.length);
    expect(replaysExactly(trajectory, reconstructed)).toBe(true);
  });

  it("flags a run auditable when every binding decision is reconstructable", () => {
    expect(store.auditRun("run-happy").auditable).toBe(true);
  });

  it("flags a run un-auditable when a decision event is suppressed", () => {
    // Suppress: delete the guard evaluations recorded for step 0.
    const side = new Database(dbPath);
    side.prepare("DELETE FROM guard_evaluations WHERE run_id = ? AND step_index = 0").run("run-happy");
    side.close();

    const report = store.auditRun("run-happy");
    expect(report.auditable).toBe(false);
    expect(report.issues.length).toBeGreaterThan(0);
    expect(store.isAuditable("run-happy")).toBe(false);
  });
});
