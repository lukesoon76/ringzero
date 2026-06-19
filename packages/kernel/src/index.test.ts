import { describe, expect, it } from "vitest";
import { PACKAGE, STANCE } from "./index.js";

describe("@ring-zero/kernel", () => {
  it("declares its identity and REAL stance", () => {
    expect(PACKAGE).toBe("@ring-zero/kernel");
    expect(STANCE).toBe("REAL");
  });
});
