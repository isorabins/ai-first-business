-- Blog Schema for Supabase
-- Run this in the Supabase SQL editor for your project

-- Categories
CREATE TABLE IF NOT EXISTS blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Main posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  excerpt TEXT,
  featured_image TEXT,
  author_id TEXT NOT NULL DEFAULT 'ai',
  drafted_by TEXT NOT NULL DEFAULT 'ai',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  rejection_note TEXT,
  category_id UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
  meta_title TEXT,
  meta_description TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tags
CREATE TABLE IF NOT EXISTS blog_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Post <-> Tag join
CREATE TABLE IF NOT EXISTS blog_post_tags (
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: public can only read published posts
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published posts are public"
  ON blog_posts FOR SELECT
  USING (status = 'published');

CREATE POLICY "Categories are public"
  ON blog_categories FOR SELECT USING (true);

CREATE POLICY "Tags are public"
  ON blog_tags FOR SELECT USING (true);

CREATE POLICY "Post tags are public"
  ON blog_post_tags FOR SELECT USING (true);

-- Seed your categories (customize these)
INSERT INTO blog_categories (name, slug, description) VALUES
  ('Tutorials', 'tutorials', 'Step-by-step guides'),
  ('Updates', 'updates', 'Project updates and announcements'),
  ('Tips', 'tips', 'Quick tips and best practices'),
  ('Case Studies', 'case-studies', 'Real-world examples and results')
ON CONFLICT (slug) DO NOTHING;
