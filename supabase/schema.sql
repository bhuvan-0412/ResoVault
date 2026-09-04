-- ResoVault Database Schema for Supabase
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor)

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_category UNIQUE (user_id, name)
);

-- 2. Create resources table
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create news_articles table (populated by scheduled cron ingestion)
CREATE TABLE IF NOT EXISTS public.news_articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  link TEXT NOT NULL UNIQUE,
  description TEXT,
  pub_date TIMESTAMPTZ,
  image_url TEXT,
  source_id TEXT,
  source_name TEXT,
  source_icon TEXT,
  category TEXT NOT NULL DEFAULT 'Technology',
  categories TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  is_breaking BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create user_topics table (user topic & domain preferences with RLS)
CREATE TABLE IF NOT EXISTS public.user_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topics TEXT[] NOT NULL DEFAULT ARRAY['Technology', 'AI & Machine Learning', 'Development', 'Product Management', 'Design'],
  custom_keywords TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_topics UNIQUE (user_id)
);

-- 5. Create user_article_clicks table (track clicks for digest weighting with RLS)
CREATE TABLE IF NOT EXISTS public.user_article_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  category TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Indexes for maximum query performance
CREATE INDEX IF NOT EXISTS idx_resources_user_id ON public.resources(user_id);
CREATE INDEX IF NOT EXISTS idx_resources_category ON public.resources(user_id, category);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_news_pub_date ON public.news_articles(pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON public.news_articles(category);
CREATE INDEX IF NOT EXISTS idx_news_breaking ON public.news_articles(is_breaking);
CREATE INDEX IF NOT EXISTS idx_user_topics_user_id ON public.user_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clicks_user ON public.user_article_clicks(user_id, clicked_at DESC);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_article_clicks ENABLE ROW LEVEL SECURITY;

-- 8. Row Level Security Policies for resources
CREATE POLICY "Users can view their own resources"
  ON public.resources
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own resources"
  ON public.resources
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own resources"
  ON public.resources
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own resources"
  ON public.resources
  FOR DELETE
  USING (auth.uid() = user_id);

-- 9. Row Level Security Policies for categories
CREATE POLICY "Users can view their own categories"
  ON public.categories
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories"
  ON public.categories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories"
  ON public.categories
  FOR DELETE
  USING (auth.uid() = user_id);

-- 10. Row Level Security Policies for news_articles
-- Shared read-only content: Any authenticated user can read all rows
DROP POLICY IF EXISTS "Anyone authenticated can view news articles" ON public.news_articles;
DROP POLICY IF EXISTS "Authenticated users can read news articles" ON public.news_articles;
DROP POLICY IF EXISTS "Service role can manage news articles" ON public.news_articles;

CREATE POLICY "Authenticated users can read news articles"
  ON public.news_articles
  FOR SELECT
  TO authenticated
  USING (true);

-- NOTE: No INSERT, UPDATE, or DELETE policies exist for regular users.
-- PostgreSQL RLS defaults to DENY for all writes. Only the server-side scheduled
-- cron job using the Supabase Service Role Key (which bypasses RLS) can write to this table.

-- 11. Row Level Security Policies for user_topics (private per user)
DROP POLICY IF EXISTS "Users can view their own topics" ON public.user_topics;
DROP POLICY IF EXISTS "Users can insert their own topics" ON public.user_topics;
DROP POLICY IF EXISTS "Users can update their own topics" ON public.user_topics;
DROP POLICY IF EXISTS "Users can delete their own topics" ON public.user_topics;

CREATE POLICY "Users can view their own topics"
  ON public.user_topics
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own topics"
  ON public.user_topics
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own topics"
  ON public.user_topics
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own topics"
  ON public.user_topics
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 12. Row Level Security Policies for user_article_clicks (private click tracking log)
DROP POLICY IF EXISTS "Users can view their own article clicks" ON public.user_article_clicks;
DROP POLICY IF EXISTS "Users can insert their own article clicks" ON public.user_article_clicks;

CREATE POLICY "Users can view their own article clicks"
  ON public.user_article_clicks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own article clicks"
  ON public.user_article_clicks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- NOTE: UPDATE and DELETE policies are intentionally omitted so click history
-- cannot be tampered with or deleted by users.

-- 13. Trigger to auto-seed default categories & topics on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Seed the 4 starting categories
  INSERT INTO public.categories (user_id, name)
  VALUES
    (NEW.id, 'Video Editing'),
    (NEW.id, 'Development'),
    (NEW.id, 'Content Creation'),
    (NEW.id, 'Product Management')
  ON CONFLICT (user_id, name) DO NOTHING;

  -- Seed default user topics
  INSERT INTO public.user_topics (user_id, topics, custom_keywords)
  VALUES (
    NEW.id,
    ARRAY['Technology', 'AI & Machine Learning', 'Development', 'Product Management', 'Design'],
    ARRAY['ai', 'react', 'nextjs', 'ux']
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 14. Schedule & Timetable Module Tables
-- =============================================================================

-- Table: fixed_events (User recurring commitments like classes, gym, meetings)
CREATE TABLE IF NOT EXISTS public.fixed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 1 = Monday, ... 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  category TEXT DEFAULT 'Fixed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: todos (Actionable user tasks with due dates, priority, and durations)
CREATE TABLE IF NOT EXISTS public.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  estimated_duration INTEGER NOT NULL DEFAULT 45, -- in minutes
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: user_schedule_preferences (Free-text notes & parsed habits/chronotype)
CREATE TABLE IF NOT EXISTS public.user_schedule_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  raw_notes TEXT,
  parsed_preferences JSONB NOT NULL DEFAULT '{"wake_time": "08:00", "sleep_time": "23:30", "peak_energy": "morning", "workout_preference": "evening", "focus_duration": 45}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: generated_schedules (ML-generated daily plan output per date)
CREATE TABLE IF NOT EXISTS public.generated_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  conflicts JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_date_schedule UNIQUE (user_id, schedule_date)
);

-- Table: schedule_completions (Tracks completed & skipped blocks for feedback loop)
CREATE TABLE IF NOT EXISTS public.schedule_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.generated_schedules(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'skipped', 'pending')),
  time_slot TEXT,
  action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_schedule_block_completion UNIQUE (schedule_id, block_id)
);

-- Indexes for Schedule module
CREATE INDEX IF NOT EXISTS idx_fixed_events_user_day ON public.fixed_events(user_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_todos_user_completed ON public.todos(user_id, completed, due_date);
CREATE INDEX IF NOT EXISTS idx_schedules_user_date ON public.generated_schedules(user_id, schedule_date DESC);
CREATE INDEX IF NOT EXISTS idx_completions_user_date ON public.schedule_completions(user_id, date DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.fixed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_schedule_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: fixed_events (Private per user)
DROP POLICY IF EXISTS "Users can manage their own fixed events" ON public.fixed_events;
CREATE POLICY "Users can manage their own fixed events"
  ON public.fixed_events
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: todos (Private per user)
DROP POLICY IF EXISTS "Users can manage their own todos" ON public.todos;
CREATE POLICY "Users can manage their own todos"
  ON public.todos
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: user_schedule_preferences (Private per user)
DROP POLICY IF EXISTS "Users can manage their own schedule preferences" ON public.user_schedule_preferences;
CREATE POLICY "Users can manage their own schedule preferences"
  ON public.user_schedule_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: generated_schedules (Private per user)
DROP POLICY IF EXISTS "Users can view their own generated schedules" ON public.generated_schedules;
CREATE POLICY "Users can view their own generated schedules"
  ON public.generated_schedules
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own generated schedules" ON public.generated_schedules;
CREATE POLICY "Users can manage their own generated schedules"
  ON public.generated_schedules
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: schedule_completions (Private per user)
DROP POLICY IF EXISTS "Users can manage their own schedule completions" ON public.schedule_completions;
CREATE POLICY "Users can manage their own schedule completions"
  ON public.schedule_completions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

