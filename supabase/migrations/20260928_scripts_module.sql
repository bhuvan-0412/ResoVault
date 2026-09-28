-- =============================================================================
-- ResoVault Video Scripts Module Migration
-- Run in Supabase Dashboard -> SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('needs_corrections', 'ready_to_shoot', 'shot', 'posted')),
  corrections_note TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  shot_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ
);

-- Automatically set updated_at, shot_at, and posted_at when status transitions
CREATE OR REPLACE FUNCTION public.handle_script_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();

  -- When advancing to 'shot', stamp shot_at if not already set
  IF NEW.status = 'shot' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'shot' OR NEW.shot_at IS NULL) THEN
    NEW.shot_at = COALESCE(NEW.shot_at, now());
  END IF;

  -- When advancing to 'posted', stamp posted_at and ensure shot_at is also set
  IF NEW.status = 'posted' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'posted' OR NEW.posted_at IS NULL) THEN
    NEW.posted_at = COALESCE(NEW.posted_at, now());
    IF NEW.shot_at IS NULL THEN
      NEW.shot_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_script_status_timestamps ON public.scripts;
CREATE TRIGGER set_script_status_timestamps
BEFORE INSERT OR UPDATE ON public.scripts
FOR EACH ROW
EXECUTE FUNCTION public.handle_script_status_timestamps();

-- Row Level Security (RLS)
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own scripts" ON public.scripts;
CREATE POLICY "Users can view their own scripts"
  ON public.scripts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own scripts" ON public.scripts;
CREATE POLICY "Users can insert their own scripts"
  ON public.scripts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own scripts" ON public.scripts;
CREATE POLICY "Users can update their own scripts"
  ON public.scripts FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own scripts" ON public.scripts;
CREATE POLICY "Users can delete their own scripts"
  ON public.scripts FOR DELETE
  USING (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_scripts_user_status ON public.scripts (user_id, status);
CREATE INDEX IF NOT EXISTS idx_scripts_user_created ON public.scripts (user_id, created_at DESC);
