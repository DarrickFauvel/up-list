CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT,
  name        TEXT,
  avatar_url  TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  provider_uid  TEXT NOT NULL,
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    INTEGER,
  UNIQUE(provider, provider_uid)
);

CREATE TABLE IF NOT EXISTS ebay_connections (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    INTEGER NOT NULL,
  scope         TEXT
);

CREATE TABLE IF NOT EXISTS items (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'draft',
  image_url       TEXT,
  image_blob      BLOB,
  notes           TEXT,
  title           TEXT,
  description     TEXT,
  item_specifics  TEXT,
  category_id     TEXT,
  condition       TEXT,
  suggested_price REAL,
  final_price     REAL,
  currency        TEXT NOT NULL DEFAULT 'USD',
  ebay_listing_id TEXT,
  ai_provider     TEXT,
  ai_model        TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  synced_at       INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_status  ON items(status);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
