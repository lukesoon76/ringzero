import { describe, expect, it } from "vitest";
import { PACKAGE, STANCE } from "./index.js";

describe("@ring-zero/pillars", () => {
  it("declares its identity and THIN stance", () => {
    expect(PACKAGE).toBe("@ring-zero/pillars");
    expect(STANCE).toBe("THIN");
  });
});
