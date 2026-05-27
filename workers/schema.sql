-- ============================================================
-- MyTaxBot LinkedIn Automation — D1 Schema
-- Run: wrangler d1 execute mytaxbot_linkedin --file=schema.sql
-- ============================================================

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,                      -- UUID v4
  type TEXT NOT NULL,                       -- 'normativa' | 'actualidad'
  sector TEXT NOT NULL,                     -- 'ecommerce' | 'content_creator' | etc
  status TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'approved' | 'rejected' | 'published' | 'scheduled'
  content TEXT NOT NULL,                    -- The LinkedIn post text (original AI-generated)
  content_edited TEXT,                      -- Edited version if user modified it
  source_id TEXT,                           -- BOE ID or article identifier
  source_url TEXT,                          -- Link to the original source
  source_name TEXT,                         -- 'BOE' | 'Expansión' | 'El Economista' | etc
  urgency TEXT DEFAULT 'media',             -- 'alta' | 'media' | 'baja'
  ai_score REAL,                            -- AI relevance score 1–10
  confidence_score REAL,                    -- Learning model confidence 0–1
  char_count INTEGER,                       -- Character count of content
  hashtags TEXT,                            -- JSON array stored as string e.g. '["#ecommerce","#IA"]'
  scheduled_at TEXT,                        -- ISO 8601 timestamp when to publish
  published_at TEXT,                        -- ISO 8601 timestamp when actually published
  linkedin_post_id TEXT,                    -- ID/URN returned by LinkedIn API after publishing
  created_at TEXT NOT NULL,                 -- ISO 8601 creation timestamp
  updated_at TEXT NOT NULL                  -- ISO 8601 last-update timestamp
);

CREATE INDEX IF NOT EXISTS idx_posts_status   ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_type     ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_sector   ON posts(sector);
CREATE INDEX IF NOT EXISTS idx_posts_urgency  ON posts(urgency);
CREATE INDEX IF NOT EXISTS idx_posts_created  ON posts(created_at DESC);

-- User decisions table (learning system training data)
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,                      -- UUID v4
  post_id TEXT NOT NULL REFERENCES posts(id),
  decision TEXT NOT NULL,                   -- 'approved' | 'rejected' | 'edited'
  edit_ratio REAL DEFAULT 0,               -- 0 = no edits, 1 = completely rewritten (Levenshtein-based)
  time_to_decide_seconds INTEGER,           -- How long the user took to decide
  post_type TEXT,                           -- Copied from post for fast analytics
  sector TEXT,                              -- Copied from post for fast analytics
  source_name TEXT,                         -- Copied from post for fast analytics
  ai_score REAL,                            -- Copied from post for fast analytics
  char_count INTEGER,                       -- Copied from post for fast analytics
  rejection_reason TEXT,                    -- Reason provided by user when rejecting
  edit_reason TEXT,                         -- Reason/explanation provided by user when editing
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decisions_post_id  ON decisions(post_id);
CREATE INDEX IF NOT EXISTS idx_decisions_sector   ON decisions(sector);
CREATE INDEX IF NOT EXISTS idx_decisions_decision ON decisions(decision);
CREATE INDEX IF NOT EXISTS idx_decisions_created  ON decisions(created_at DESC);

-- LinkedIn OAuth tokens (single-row table, id='linkedin')
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY DEFAULT 'linkedin',
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TEXT NOT NULL,                 -- ISO 8601 expiry timestamp
  linkedin_urn TEXT,                        -- User URN: 'urn:li:person:XXXXX'
  updated_at TEXT NOT NULL
);

-- System stats cache (key-value, values are JSON blobs)
CREATE TABLE IF NOT EXISTS stats_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,                      -- JSON-serialised value
  updated_at TEXT NOT NULL
);
