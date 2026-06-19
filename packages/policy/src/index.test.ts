import { describe, expect, it } from "vitest";
import { CAPABILITIES } from "./capabilities.js";
import { PACKAGE, STANCE } from "./index.js";

describe("@ring-zero/policy", () => {
  it("declares its identity and REAL stance", () => {
    expect(PACKAGE).toBe("@ring-zero/policy");
    expect(STANCE).toBe("REAL");
  });

  it("defines the four capabilities C1–C4", () => {
    expect(CAPABILITIES.map((c) => c.id)).toEqual(["C1", "C2", "C3", "C4"]);
  });
});
