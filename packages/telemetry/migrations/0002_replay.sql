-- 0002_replay — columns needed to reconstruct every binding decision + state.
-- Phase 4 makes runs replayable from telemetry alone; a run missing the rows to
-- reconstruct a decision is flagged un-auditable.

ALTER TABLE runs ADD COLUMN policy_id TEXT;
ALTER TABLE runs ADD COLUMN terminal_kind TEXT;
ALTER TABLE runs ADD COLUMN terminal_detail TEXT;

ALTER TABLE spans ADD COLUMN from_node TEXT;
ALTER TABLE spans ADD COLUMN to_node TEXT;
ALTER TABLE spans ADD COLUMN action_kind TEXT;
ALTER TABLE spans ADD COLUMN step_index INTEGER;
ALTER TABLE spans ADD COLUMN decision TEXT;
ALTER TABLE spans ADD COLUMN outcome TEXT;
ALTER TABLE spans ADD COLUMN guard_eval_count INTEGER;
ALTER TABLE spans ADD COLUMN pre_attrs TEXT;   -- JSON GovernedAttributes before the step
ALTER TABLE spans ADD COLUMN post_attrs TEXT;  -- JSON GovernedAttributes after the step
ALTER TABLE spans ADD COLUMN note TEXT;

CREATE INDEX IF NOT EXISTS idx_spans_step ON spans(run_id, step_index);
