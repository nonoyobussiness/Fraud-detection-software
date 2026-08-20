/*
  Add llm_reason column to risk_assessments.

  Stores an optional LLM-narrated version of the deterministic `reason` string.
  Nullable — stays null if the LLM call is skipped, fails, or times out. The
  deterministic `reason` column remains the source of truth for the decision;
  this column is purely a display enhancement.
*/

ALTER TABLE risk_assessments
  ADD COLUMN IF NOT EXISTS llm_reason text;
