/**
 * Unified workflow importer. Users bring workflows in many formats; Regent
 * NORMALISES each to its canonical WorkflowSpec via a format adapter, then
 * governs the normalised graph. No imported code ever runs on the binding path —
 * only declarative structure is compiled to vetted kernel primitives.
 */

import type { WorkflowSpec } from "@ring-zero/policy";
import { compileManifestToWorkflow } from "./compile-manifest.js";
import { compileCrewAI, type CrewAISpec } from "./crewai.js";
import { compileLangGraph, type LangGraphSpec } from "./langgraph.js";
import type { AgentManifest } from "./manifest.js";

export type WorkflowFormat = "regent-spec" | "langgraph" | "crewai" | "agent-manifest" | "unknown";

/** Sniff the shape of an uploaded workflow. */
export function detectWorkflowFormat(o: unknown): WorkflowFormat {
  if (!o || typeof o !== "object") return "unknown";
  const r = o as Record<string, unknown>;
  if (Array.isArray(r.states) && Array.isArray(r.transitions)) return "regent-spec";
  if (typeof r.entrypoint === "string" && Array.isArray(r.nodes) && Array.isArray(r.edges)) return "langgraph";
  if (Array.isArray(r.tasks) && Array.isArray(r.agents)) return "crewai";
  if (typeof r.source === "string" && r.enforcement !== undefined && Array.isArray(r.nodes)) return "agent-manifest";
  return "unknown";
}

export interface CompiledImport {
  readonly format: WorkflowFormat;
  readonly workflow: WorkflowSpec;
}

/** Detect the format and compile it to a governed WorkflowSpec. */
export function compileImportedWorkflow(o: unknown): CompiledImport {
  const format = detectWorkflowFormat(o);
  switch (format) {
    case "regent-spec":
      return { format, workflow: o as WorkflowSpec };
    case "langgraph":
      return { format, workflow: compileLangGraph(o as LangGraphSpec) };
    case "crewai":
      return { format, workflow: compileCrewAI(o as CrewAISpec) };
    case "agent-manifest":
      return { format, workflow: compileManifestToWorkflow(o as AgentManifest) };
    default:
      throw new Error("unrecognised workflow format — expected a Regent spec, LangGraph graph, CrewAI crew, or agent manifest");
  }
}
