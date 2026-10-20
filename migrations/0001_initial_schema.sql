-- migrations/0001_initial_schema.sql
-- Cloudflare D1 Relational Schema for captures-gallery

-- Collections Table
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_capture_id TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Captures Table
CREATE TABLE IF NOT EXISTS captures (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  story TEXT,
  collection_slug TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  image_url TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  aspect_ratio REAL NOT NULL,
  location TEXT,
  captured_at TEXT,
  camera_model TEXT,
  lens_model TEXT,
  focal_length TEXT,
  aperture TEXT,
  shutter_speed TEXT,
  iso INTEGER,
  tags_json TEXT DEFAULT '[]',
  featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (collection_slug) REFERENCES collections(slug) ON DELETE CASCADE
);

-- Query optimization indexes
CREATE INDEX IF NOT EXISTS idx_captures_collection ON captures(collection_slug);
CREATE INDEX IF NOT EXISTS idx_captures_featured ON captures(featured);
CREATE INDEX IF NOT EXISTS idx_captures_captured_at ON captures(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_captures_camera ON captures(camera_model);

-- Seed Initial Curated Collections
INSERT OR IGNORE INTO collections (id, slug, title, description, cover_capture_id, sort_order, created_at) VALUES
  ('col-architecture', 'architecture', 'Architectural geometry', 'Studies in poured concrete, cantilevered forms, and directional daylight across modern urban structures.', 'cap-brutalist-atrium-01', 1, '2026-01-15T10:00:00Z'),
  ('col-street', 'street', 'Nocturnal street & transit', 'Fleeting human silhouettes, neon reflections on wet asphalt, and quiet solitude inside dense metropolitan corridors.', 'cap-shibuya-rain-reflections', 2, '2026-01-20T10:00:00Z'),
  ('col-minimalism', 'minimalism', 'Atmospheric minimalism', 'Negative space, coastal fog, and quiet horizon lines captured with long exposures and medium-format optics.', 'cap-mist-over-lake-biwa', 3, '2026-01-25T10:00:00Z');
