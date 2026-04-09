import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = process.env.DB_DIR || __dirname;
const DB_PATH = join(DB_DIR, 'teamboard.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- 建表 ---
db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    type          TEXT NOT NULL CHECK(type IN ('skill', 'mcp')),
    status        TEXT NOT NULL CHECK(status IN ('next', 'active', 'done')) DEFAULT 'next',
    priority      TEXT NOT NULL CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
    description   TEXT DEFAULT '',
    owner         TEXT DEFAULT '',
    deadline      TEXT DEFAULT '',
    related_skill TEXT DEFAULT '',
    attachment    TEXT DEFAULT '',
    result        TEXT CHECK(result IS NULL OR result IN ('adopted', 'shelved')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS variants (
    id            TEXT PRIMARY KEY,
    plan_id       TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    uploader      TEXT NOT NULL,
    description   TEXT DEFAULT '',
    link          TEXT DEFAULT '',
    content       TEXT,
    uploaded_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scores (
    id            TEXT PRIMARY KEY,
    variant_id    TEXT NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    plan_id       TEXT NOT NULL,
    tester        TEXT NOT NULL,
    dim_id        TEXT NOT NULL,
    value         INTEGER NOT NULL CHECK(value >= 0),
    comment       TEXT DEFAULT '',
    eval_doc      TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dimensions (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    max           INTEGER NOT NULL DEFAULT 10,
    active        INTEGER NOT NULL DEFAULT 1,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('admin', 'tester', 'member')) DEFAULT 'member',
    display_name  TEXT DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// --- Seed 默认维度（仅在表为空时）---
const dimCount = db.prepare('SELECT COUNT(*) AS c FROM dimensions').get().c;
if (dimCount === 0) {
  const insertDim = db.prepare('INSERT INTO dimensions (id, name, max, active, sort_order) VALUES (?, ?, ?, 1, ?)');
  insertDim.run('d1', '功能完整性', 10, 0);
  insertDim.run('d2', '稳定性', 10, 1);
  insertDim.run('d3', '用户体验', 10, 2);
  console.log('[db] Seeded 3 default dimensions');
}

// --- Seed 默认管理员（仅在 users 表为空时）---
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)')
    .run('u_admin', 'admin', hash, 'admin', '管理员');
  console.log('[db] Seeded default admin user (admin / admin123)');
}

// --- 迁移：为旧 DB 补全新字段 ---
try {
  // plans 表
  const planCols = db.prepare("PRAGMA table_info(plans)").all().map(c => c.name);
  const planMigrations = [
    ['owner', "ALTER TABLE plans ADD COLUMN owner TEXT DEFAULT ''"],
    ['deadline', "ALTER TABLE plans ADD COLUMN deadline TEXT DEFAULT ''"],
    ['related_skill', "ALTER TABLE plans ADD COLUMN related_skill TEXT DEFAULT ''"],
    ['attachment', "ALTER TABLE plans ADD COLUMN attachment TEXT DEFAULT ''"],
  ];
  for (const [col, sql] of planMigrations) {
    if (!planCols.includes(col)) {
      db.exec(sql);
      console.log(`[db] Migrated: added column plans.${col}`);
    }
  }

  // variants 表
  const varCols = db.prepare("PRAGMA table_info(variants)").all().map(c => c.name);
  if (!varCols.includes('attachments')) {
    db.exec("ALTER TABLE variants ADD COLUMN attachments TEXT DEFAULT ''");
    console.log('[db] Migrated: added column variants.attachments');
  }
} catch (e) {
  console.warn('[db] Migration warning:', e.message);
}

console.log(`[db] SQLite ready at ${DB_PATH}`);

export default db;
