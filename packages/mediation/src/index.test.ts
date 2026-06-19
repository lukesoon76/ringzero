import { describe, expect, it } from "vitest";
import { PACKAGE, STANCE } from "./index.js";

describe("@ring-zero/mediation", () => {
  it("declares its identity and REAL stance", () => {
    expect(PACKAGE).toBe("@ring-zero/mediation");
    expect(STANCE).toBe("REAL");
  });
});
