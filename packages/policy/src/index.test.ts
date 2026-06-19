import { describe, expect, it } from "vitest";
import { PACKAGE, PHASE, STANCE } from "./index.js";

describe("@ring-zero/policy scaffold", () => {
  it("declares its identity and Phase 0 stance", () => {
    expect(PACKAGE).toBe("@ring-zero/policy");
    expect(PHASE).toBe(0);
    expect(STANCE).toBe("REAL");
  });
});
