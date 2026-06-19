-- 0003_registry — the agent registry (Pillar P1). Lives in the same SQLite store
-- as the traces so an agent card can link directly to its governed runs.

CREATE TABLE IF NOT EXISTS agents (
  agent_id         TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  purpose          TEXT NOT NULL,
  owner            TEXT NOT NULL,
  supervising_user TEXT NOT NULL,
  tier             INTEGER NOT NULL,
  tools            TEXT NOT NULL,   -- JSON array
  authority_scopes TEXT NOT NULL,   -- JSON array
  capabilities     TEXT NOT NULL    -- JSON array
);
