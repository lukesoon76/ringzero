/**
 * @ring-zero/mediation — complete-mediation tool gateway (P4), agent identity +
 * default-deny least privilege (P7), authenticated approval events (P8), and a
 * secrets-broker stub. See ../../ARCHITECTURE.md and ../../CLAUDE.md.
 */

export const PACKAGE = "@ring-zero/mediation";
export const STANCE = "REAL" as const;

export * from "./identity.js";
export * from "./secrets.js";
export * from "./events.js";
export * from "./approval-service.js";
export * from "./gateway.js";
export * from "./guardrails.js";
export * from "./mcp-gateway.js";
