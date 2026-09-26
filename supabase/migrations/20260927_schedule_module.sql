-- =============================================================================
-- ResoVault Schedule & Timetable Module Migration
-- Phase 1 - 4 Database Architecture
-- Run in Supabase Dashboard -> SQL Editor
-- =============================================================================

-- 1. Table: fixed_classes (Structured recurring commitments)
CREATE TABLE IF NOT EXISTS public.fixed_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sun, 1 = Mon ... 6 = Sat
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,
  color TEXT NOT NULL DEFAULT 'indigo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Table: deadlines (Separate task / deadline list)
CREATE TABLE IF NOT EXISTS public.deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  due_time TIME,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  estimated_duration INTEGER NOT NULL DEFAULT 45, -- in minutes
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Table: schedule_blocks (The generated timetable output)
CREATE TABLE IF NOT EXISTS public.schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('class', 'study', 'task', 'break', 'free')),
  linked_deadline_id UUID REFERENCES public.deadlines(id) ON DELETE SET NULL,
  energy_level_required TEXT CHECK (energy_level_required IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Table: energy_logs (Energy tagging and learned patterns)
CREATE TABLE IF NOT EXISTS public.energy_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_block TEXT NOT NULL, -- e.g. "09:00-10:00" or start time slot
  energy_level TEXT NOT NULL CHECK (energy_level IN ('low', 'medium', 'high')),
  derived_score NUMERIC, -- learned completion score for this slot
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_date_slot UNIQUE (user_id, date, time_block)
);

-- 5. Table: streaks (Overall adherence and per-task/category streaks)
CREATE TABLE IF NOT EXISTS public.streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streak_type TEXT NOT NULL CHECK (streak_type IN ('daily_adherence', 'category')),
  category TEXT, -- NULL for daily adherence, category name for category streaks
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_completed_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_streak_type_category UNIQUE (user_id, streak_type, category)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fixed_classes_user_day ON public.fixed_classes(user_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_deadlines_user_due ON public.deadlines(user_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_user_date ON public.schedule_blocks(user_id, date, start_time);
CREATE INDEX IF NOT EXISTS idx_energy_logs_user_date ON public.energy_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_streaks_user ON public.streaks(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.fixed_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: fixed_classes (Private per user)
DROP POLICY IF EXISTS "Users can manage their own fixed classes" ON public.fixed_classes;
CREATE POLICY "Users can manage their own fixed classes"
  ON public.fixed_classes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: deadlines (Private per user)
DROP POLICY IF EXISTS "Users can manage their own deadlines" ON public.deadlines;
CREATE POLICY "Users can manage their own deadlines"
  ON public.deadlines
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: schedule_blocks (Private per user)
DROP POLICY IF EXISTS "Users can manage their own schedule blocks" ON public.schedule_blocks;
CREATE POLICY "Users can manage their own schedule blocks"
  ON public.schedule_blocks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: energy_logs (Private per user)
DROP POLICY IF EXISTS "Users can manage their own energy logs" ON public.energy_logs;
CREATE POLICY "Users can manage their own energy logs"
  ON public.energy_logs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: streaks (Private per user)
DROP POLICY IF EXISTS "Users can manage their own streaks" ON public.streaks;
CREATE POLICY "Users can manage their own streaks"
  ON public.streaks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
