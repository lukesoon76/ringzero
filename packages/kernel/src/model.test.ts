import { describe, expect, it } from "vitest";
import { makeState, validateAttributes, type RawAttributes } from "./model.js";

const good: RawAttributes = {
  Alignment: 1,
  Verified: 1,
  Length: 0,
  Information: 0.5,
  Confidence: 0.9,
};

describe("attribute validation (fail closed on bad input)", () => {
  it("accepts a well-formed attribute bag", () => {
    expect(validateAttributes(good).ok).toBe(true);
  });

  it("treats a missing attribute as unknown, not zero", () => {
    const r = validateAttributes({ Alignment: 1, Verified: 1, Length: 0, Information: 0.5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Confidence/);
  });

  it("rejects an out-of-range Alignment", () => {
    expect(validateAttributes({ ...good, Alignment: 1.5 }).ok).toBe(false);
  });

  it("rejects a non-binary Verified", () => {
    expect(validateAttributes({ ...good, Verified: 2 }).ok).toBe(false);
  });

  it("rejects a non-integer Length", () => {
    expect(validateAttributes({ ...good, Length: 1.5 }).ok).toBe(false);
  });

  it("rejects NaN", () => {
    expect(validateAttributes({ ...good, Confidence: Number.NaN }).ok).toBe(false);
  });

  it("makeState throws on a malformed seed", () => {
    expect(() =>
      makeState({
        node: "s0",
        attrs: { Alignment: 2, Verified: 0, Length: 0, Information: 0, Confidence: 0 },
      }),
    ).toThrow();
  });
});
