import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "./migrate.js";

const dir = mkdtempSync(join(tmpdir(), "rz-migrate-"));
const dbPath = join(dir, "test.db");

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("SQLite migration runner", () => {
  it("applies 0001_init on a fresh database", () => {
    const result = migrate(dbPath);
    expect(result.applied).toContain("0001_init.sql");
  });

  it("is idempotent — a second run applies nothing new", () => {
    const result = migrate(dbPath);
    expect(result.applied).toHaveLength(0);
    expect(result.alreadyApplied).toContain("0001_init.sql");
  });
});
