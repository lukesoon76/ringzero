import { runWorkflowSpec } from "@ring-zero/policy";
import { describe, expect, it } from "vitest";
import { compileCrewAI } from "./crewai.js";
import { compileImportedWorkflow, detectWorkflowFormat } from "./import-workflow.js";

const crew = {
  name: "research-crew",
  process: "sequential",
  agents: [{ role: "Researcher", tools: ["web_search"] }, { role: "Writer" }, { role: "Publisher", tools: ["publish_api"] }],
  tasks: [
    { description: "Research the topic", agent: "Researcher", tools: ["web_search"] },
    { description: "Write the brief", agent: "Writer" },
    { description: "Publish externally", agent: "Publisher", tools: ["publish_api"] },
  ],
};
const langgraph = { entrypoint: "start", finish: "done", nodes: [{ name: "a", kind: "agent" }, { name: "done", kind: "tool" }], edges: [{ from: "start", to: "a" }, { from: "a", to: "done" }] };
const regentSpec = { id: "x", states: [{ id: "s", initial: true, terminal: true }], transitions: [], seed: { attrs: { Alignment: 1, Verified: 1, Confidence: 1, Length: 0, Information: 1 } } };
const manifest = { id: "m", name: "M", source: "code-scan", enforcement: { mode: "inline", bindable: true, via: "x" }, nodes: [{ id: "n", name: "n", kind: "agent" }], edges: [], riskSignals: { agency: 1, authority: 1, impact: 1, exposure: 1, recoverability: 1 } };

describe("unified workflow importer", () => {
  it("detects each supported format", () => {
    expect(detectWorkflowFormat(regentSpec)).toBe("regent-spec");
    expect(detectWorkflowFormat(langgraph)).toBe("langgraph");
    expect(detectWorkflowFormat(crew)).toBe("crewai");
    expect(detectWorkflowFormat(manifest)).toBe("agent-manifest");
    expect(detectWorkflowFormat({ foo: 1 })).toBe("unknown");
  });

  it("compiles a CrewAI crew to a governed workflow and infers a dispatch intent", () => {
    const w = compileCrewAI(crew as never);
    expect(w.states.find((s) => s.initial)?.id).toBe("start");
    expect(w.states.find((s) => s.terminal)?.id).toBe("done");
    // the publish task uses an external tool → dispatch intent
    const last = w.transitions.find((t) => t.to === "done" || t.action.intent === "dispatch");
    expect(w.transitions.some((t) => t.action.intent === "dispatch")).toBe(true);
    expect(last).toBeTruthy();
  });

  it("governs an imported CrewAI crew: an external publish is contained without approval", () => {
    const { format, workflow } = compileImportedWorkflow(crew);
    expect(format).toBe("crewai");
    const t = runWorkflowSpec(workflow);
    expect(t.terminal.kind).not.toBe("Complete"); // dispatch without authenticated sign-off → contained
  });

  it("passes a Regent spec through and rejects an unknown shape", () => {
    expect(compileImportedWorkflow(regentSpec).format).toBe("regent-spec");
    expect(() => compileImportedWorkflow({ nope: true })).toThrow(/unrecognised/);
  });
});
