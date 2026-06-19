/**
 * P1 — Discovery & inventory. A SQLite-backed agent registry; the agent card
 * shows purpose, owner, tools, authority, linked capabilities, and live links to
 * the agent's governed runs (resolved from the same trace store).
 */

import { migrate } from "@ring-zero/telemetry";
import Database from "better-sqlite3";

export interface AgentRecord {
  readonly agentId: string;
  readonly name: string;
  readonly purpose: string;
  readonly owner: string;
  readonly supervisingUser: string;
  readonly tier: number;
  readonly tools: readonly string[];
  readonly authorityScopes: readonly string[];
  readonly capabilities: readonly string[];
}

export interface TraceLink {
  readonly runId: string;
  readonly governed: boolean;
  readonly terminalKind: string;
  readonly auditable: boolean;
}

export interface AgentCard extends AgentRecord {
  readonly traceLinks: readonly TraceLink[];
}

interface AgentRow {
  agent_id: string;
  name: string;
  purpose: string;
  owner: string;
  supervising_user: string;
  tier: number;
  tools: string;
  authority_scopes: string;
  capabilities: string;
}

export class Registry {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    migrate(dbPath);
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
  }

  close(): void {
    this.db.close();
  }

  register(rec: AgentRecord): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO agents
         (agent_id, name, purpose, owner, supervising_user, tier, tools, authority_scopes, capabilities)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        rec.agentId,
        rec.name,
        rec.purpose,
        rec.owner,
        rec.supervisingUser,
        rec.tier,
        JSON.stringify(rec.tools),
        JSON.stringify(rec.authorityScopes),
        JSON.stringify(rec.capabilities),
      );
  }

  private toRecord(row: AgentRow): AgentRecord {
    return {
      agentId: row.agent_id,
      name: row.name,
      purpose: row.purpose,
      owner: row.owner,
      supervisingUser: row.supervising_user,
      tier: row.tier,
      tools: JSON.parse(row.tools) as string[],
      authorityScopes: JSON.parse(row.authority_scopes) as string[],
      capabilities: JSON.parse(row.capabilities) as string[],
    };
  }

  list(): readonly AgentRecord[] {
    const rows = this.db.prepare("SELECT * FROM agents ORDER BY agent_id").all() as AgentRow[];
    return rows.map((r) => this.toRecord(r));
  }

  getAgentCard(agentId: string): AgentCard | undefined {
    const row = this.db.prepare("SELECT * FROM agents WHERE agent_id = ?").get(agentId) as AgentRow | undefined;
    if (!row) return undefined;
    const links = this.db
      .prepare("SELECT run_id, governed, terminal_kind, auditable FROM runs WHERE agent_id = ? ORDER BY run_id")
      .all(agentId) as { run_id: string; governed: number; terminal_kind: string; auditable: number }[];
    return {
      ...this.toRecord(row),
      traceLinks: links.map((l) => ({
        runId: l.run_id,
        governed: l.governed === 1,
        terminalKind: l.terminal_kind,
        auditable: l.auditable === 1,
      })),
    };
  }
}
