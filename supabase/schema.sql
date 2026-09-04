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
