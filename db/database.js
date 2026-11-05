const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { databasePath } = require('../config');
const { seedInitialPosts } = require('./seed');

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.function('fold', { deterministic: true }, (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
    email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(email) <= 254),
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'writer' CHECK (role IN ('writer', 'admin')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL DEFAULT 'Equipo ByteGuard' CHECK (length(author_name) BETWEEN 2 AND 80),
    title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
    slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 180),
    excerpt TEXT NOT NULL CHECK (length(excerpt) BETWEEN 10 AND 500),
    content TEXT NOT NULL CHECK (length(content) BETWEEN 20 AND 50000),
    category TEXT NOT NULL DEFAULT 'Seguridad' CHECK (length(category) BETWEEN 2 AND 50),
    reading_minutes INTEGER NOT NULL DEFAULT 1 CHECK (reading_minutes >= 1 AND reading_minutes <= 999),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published')),
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(email) <= 254),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_posts_publication
    ON posts (status, published_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_posts_author
    ON posts (author_id, updated_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_posts_review
    ON posts (status, created_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_active
    ON subscriptions (active, created_at DESC);
`);

// Additive migrations preserve articles and accounts created with version 1.
db.transaction(() => {
  const addColumn = (table, name, definition) => {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some((column) => column.name === name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    }
  };
  addColumn('users', 'active', 'INTEGER NOT NULL DEFAULT 1');
  addColumn('users', 'bio', "TEXT NOT NULL DEFAULT ''");
  addColumn('posts', 'source_content', "TEXT NOT NULL DEFAULT ''");
  addColumn('posts', 'content_format', "TEXT NOT NULL DEFAULT 'html'");
  addColumn('posts', 'review_note', "TEXT NOT NULL DEFAULT ''");
  addColumn('posts', 'version', 'INTEGER NOT NULL DEFAULT 1');
  addColumn('posts', 'featured', 'INTEGER NOT NULL DEFAULT 0');
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bookmarks (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL CHECK (length(content) BETWEEN 3 AND 1500),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS editorial_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_post ON editorial_events(post_id, id);
    PRAGMA user_version = 2;
  `);
})();

const seededPosts = seedInitialPosts(db);
if (seededPosts > 0) {
  console.info(`Base de datos inicializada con ${seededPosts} artículos publicados.`);
}

module.exports = { db };
