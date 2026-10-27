-- =============================================================================
-- ResoVault Vault: folder management (rename / merge / delete / reorder)
-- Run in Supabase Dashboard -> SQL Editor. Safe to run more than once.
-- =============================================================================

-- 1. Per-user folder order
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS position DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_categories_user_position
  ON public.categories (user_id, position);

-- 2. UPDATE policy (renames + reordering were previously blocked by RLS)
DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
CREATE POLICY "Users can update their own categories"
  ON public.categories
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Backfill positions (only rows without one): the 11 standard folders in
--    their canonical order, then any other folders alphabetically after them.
UPDATE public.categories c
SET position = f.pos
FROM (VALUES
  ('Content', 1000),
  ('Video Editing', 2000),
  ('AI Tools & Prompts', 3000),
  ('Design & Web', 4000),
  ('Dev & GitHub', 5000),
  ('Product Management', 6000),
  ('Career & Roadmaps', 7000),
  ('Startups', 8000),
  ('Certificates', 9000),
  ('Acads', 10000),
  ('Personal', 11000)
) AS f(name, pos)
WHERE c.name = f.name AND c.position IS NULL;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY name) AS rn
  FROM public.categories
  WHERE position IS NULL
)
UPDATE public.categories c
SET position = 100000 + ranked.rn * 1000
FROM ranked
WHERE c.id = ranked.id;

-- 4. New users get the 11 standard folders instead of the old 4
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, position)
  VALUES
    (NEW.id, 'Content', 1000),
    (NEW.id, 'Video Editing', 2000),
    (NEW.id, 'AI Tools & Prompts', 3000),
    (NEW.id, 'Design & Web', 4000),
    (NEW.id, 'Dev & GitHub', 5000),
    (NEW.id, 'Product Management', 6000),
    (NEW.id, 'Career & Roadmaps', 7000),
    (NEW.id, 'Startups', 8000),
    (NEW.id, 'Certificates', 9000),
    (NEW.id, 'Acads', 10000),
    (NEW.id, 'Personal', 11000)
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
