-- =============================================================================
-- ResoVault Scripts: custom ordering (position)
-- Run in Supabase Dashboard -> SQL Editor. Safe to run more than once.
-- =============================================================================

-- 1. Column
ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS position DOUBLE PRECISION;

-- 2. Timestamp trigger: only bump updated_at when something other than
--    position changed, so reordering never alters "Last updated" or the
--    "Ready to Shoot" default order.
CREATE OR REPLACE FUNCTION public.handle_script_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR (to_jsonb(NEW) - 'position' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'position' - 'updated_at') THEN
    NEW.updated_at = now();
  ELSE
    NEW.updated_at = OLD.updated_at;
  END IF;

  -- When advancing to 'shot', stamp shot_at if not already set
  IF NEW.status = 'shot' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'shot' OR NEW.shot_at IS NULL) THEN
    NEW.shot_at = COALESCE(NEW.shot_at, now());
  END IF;

  -- When advancing to 'posted', stamp posted_at and ensure shot_at is also set
  IF NEW.status = 'posted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'posted' OR NEW.posted_at IS NULL) THEN
    NEW.posted_at = COALESCE(NEW.posted_at, now());
    IF NEW.shot_at IS NULL THEN
      NEW.shot_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Backfill (only rows without a position), per user and per status:
--    Draft: created_at newest first | Ready: updated_at oldest first
--    Shot: shot_at oldest first     | Posted: posted_at oldest first
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, status
      ORDER BY
        CASE status
          WHEN 'needs_corrections' THEN -EXTRACT(EPOCH FROM created_at)
          WHEN 'ready_to_shoot'    THEN  EXTRACT(EPOCH FROM updated_at)
          WHEN 'shot'              THEN  EXTRACT(EPOCH FROM COALESCE(shot_at, created_at))
          ELSE                          EXTRACT(EPOCH FROM COALESCE(posted_at, shot_at, created_at))
        END,
        id
    ) AS rn
  FROM public.scripts
  WHERE position IS NULL
)
UPDATE public.scripts s
SET position = ranked.rn * 1000
FROM ranked
WHERE s.id = ranked.id;

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_scripts_user_status_position
  ON public.scripts (user_id, status, position);
