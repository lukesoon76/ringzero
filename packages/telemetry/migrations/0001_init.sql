-- 0001_init — governance telemetry skeleton.
-- Phase 0 establishes the spine that Phase 4 instrumentation/replay fills in:
-- one run = one trace; spans carry tool-intent + resource-scope; guard
-- evaluations, authz decisions, approval events and containment actions are
-- recorded so any binding decision can be reconstructed. A run missing the
-- telemetry to reconstruct a decision is flagged un-auditable (set in Phase 4).

CREATE TABLE IF NOT EXISTS runs (
  run_id      TEXT PRIMARY KEY,        -- one run = one trace id
  agent_id    TEXT NOT NULL,
  governed    INTEGER NOT NULL,        -- 0 = ungoverned, 1 = Regent on
  tier        INTEGER,                 -- resolved risk tier (P2), nullable until set
  started_at  TEXT NOT NULL,
  ended_at    TEXT,
  terminal    TEXT,                    -- Halt | Escalate | Abstain | Complete
  auditable   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS spans (
  span_id       TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  parent_span_id TEXT,
  name          TEXT NOT NULL,
  capability_id TEXT,                  -- C1..C4 when the span is a capability
  capability_ver TEXT,
  tool_intent   TEXT,                  -- read | retrieve | compute | write | dispatch
  resource_scope TEXT,
  started_at    TEXT NOT NULL,
  ended_at      TEXT
);

CREATE TABLE IF NOT EXISTS guard_evaluations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id      TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  span_id     TEXT REFERENCES spans(span_id) ON DELETE CASCADE,
  step_index  INTEGER NOT NULL,
  guard       TEXT NOT NULL,           -- which guard in the fixed-priority loop
  score       REAL,
  threshold   REAL,
  outcome     TEXT NOT NULL,           -- continue | retrieve | verify | escalate | halt | abstain | block
  advisory    INTEGER NOT NULL DEFAULT 0  -- 1 = LLM/embedding advisory signal, never binding
);

CREATE TABLE IF NOT EXISTS approval_events (
  approval_id TEXT PRIMARY KEY,        -- authenticated, signed approval record
  run_id      TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  approver    TEXT NOT NULL,
  signature   TEXT NOT NULL,           -- proof this was an authenticated event, not a chat signal
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spans_run ON spans(run_id);
CREATE INDEX IF NOT EXISTS idx_guard_run ON guard_evaluations(run_id);
CREATE INDEX IF NOT EXISTS idx_approval_run ON approval_events(run_id);
