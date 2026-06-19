import { describe, expect, it } from "vitest";
import { PACKAGE, PHASE, STANCE } from "./index.js";

describe("@ring-zero/pillars scaffold", () => {
  it("declares its identity and Phase 0 stance", () => {
    expect(PACKAGE).toBe("@ring-zero/pillars");
    expect(PHASE).toBe(0);
    expect(STANCE).toBe("THIN");
  });
});
