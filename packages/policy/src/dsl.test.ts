import { PolicyCompileError } from "@ring-zero/kernel";
import { describe, expect, it } from "vitest";
import { capabilityAction, definePolicy } from "./dsl.js";

const noop = () => ({});

describe("policy DSL → W compiler", () => {
  it("compiles a well-formed policy to a frozen W", () => {
    const W = definePolicy("p")
      .state("a", { initial: true })
      .state("b", { terminal: true })
      .transition({ from: "a", to: "b", action: capabilityAction("C", "go", "compute"), effect: noop })
      .compile();
    expect(W.s0).toBe("a");
    expect(W.terminals.has("b")).toBe(true);
    expect(W.actions.has("C.go")).toBe(true);
    expect(Object.isFrozen(W)).toBe(true);
  });

  it("rejects an edge to an undeclared node", () => {
    expect(() =>
      definePolicy("p")
        .state("a", { initial: true })
        .transition({ from: "a", to: "ghost", action: capabilityAction("C", "go", "compute"), effect: noop })
        .compile(),
    ).toThrow(PolicyCompileError);
  });

  it("rejects a duplicate (from, action) — δ must be a function", () => {
    const a = capabilityAction("C", "go", "compute");
    expect(() =>
      definePolicy("p")
        .state("a", { initial: true })
        .state("b")
        .state("c")
        .transition({ from: "a", to: "b", action: a, effect: noop })
        .transition({ from: "a", to: "c", action: a, effect: noop })
        .compile(),
    ).toThrow(/non-deterministic/);
  });

  it("requires an initial state", () => {
    expect(() => definePolicy("p").state("a").compile()).toThrow(PolicyCompileError);
  });
});
