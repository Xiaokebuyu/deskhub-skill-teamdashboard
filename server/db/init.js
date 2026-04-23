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
  if (process.env.NODE_ENV === 'production') {
    const crypto = await import('crypto');
    const tempPwd = crypto.randomBytes(12).toString('base64url');
    const hash = bcrypt.hashSync(tempPwd, 10);
    db.prepare('INSERT INTO users (id, username, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)')
      .run('u_admin', 'admin', hash, 'admin', '管理员');
    console.log(`[db] 生产环境：已创建管理员账号 admin，临时密码: ${tempPwd}`);
    console.log('[db] ⚠ 请登录后立即修改密码！');
  } else {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (id, username, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)')
      .run('u_admin', 'admin', hash, 'admin', '管理员');
    console.log('[db] Seeded default admin user (admin / admin123)');
  }
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

// --- 变更日志表（飞书机器人推送用）---
db.exec(`
  CREATE TABLE IF NOT EXISTS change_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type   TEXT NOT NULL,
    entity_id     TEXT NOT NULL,
    action        TEXT NOT NULL,
    summary       TEXT DEFAULT '',
    actor         TEXT DEFAULT '',
    priority      TEXT DEFAULT 'medium',
    related_users TEXT DEFAULT '[]',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    notified      INTEGER NOT NULL DEFAULT 0
  );
`);

// --- 迁移：users 表加 feishu_open_id ---
try {
  const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!userCols.includes('feishu_open_id')) {
    db.exec("ALTER TABLE users ADD COLUMN feishu_open_id TEXT DEFAULT ''");
    console.log('[db] Migrated: added column users.feishu_open_id');
  }
} catch (e) {
  console.warn('[db] feishu_open_id migration warning:', e.message);
}

// --- 迁移：patrol_config 键值表（R5，巡检/通知可控配置） ---
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patrol_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const DEFAULTS = [
    ['patrol_hour',         String(process.env.BOT_PATROL_HOUR || 9)],
    ['patrol_enabled',      '1'],
    ['deadline_alert_days', '3'],
  ];
  // 只在 key 不存在时 INSERT，保留已有值
  const seedStmt = db.prepare('INSERT OR IGNORE INTO patrol_config (key, value) VALUES (?, ?)');
  for (const [k, v] of DEFAULTS) seedStmt.run(k, v);

  // 2026-04-22 废字段清理（钩子驱动通知系统替代，不再需要 flush 窗口和群 id）
  db.prepare(
    "DELETE FROM patrol_config WHERE key IN ('high_flush_ms', 'normal_flush_ms', 'notify_chat_ids')"
  ).run();
} catch (e) {
  console.warn('[db] patrol_config migration warning:', e.message);
}

// --- 迁移：permissions 表（R1，ability 级权限扩展） ---
// user_id × ability 唯一；assertAbility 查不到时 fallback 到 users.role 默认（见 bot/abilities.js）
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      ability TEXT NOT NULL,
      granted_at TEXT DEFAULT (datetime('now')),
      granted_by TEXT DEFAULT '',
      UNIQUE(user_id, ability)
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_permissions_user ON permissions(user_id)');
} catch (e) {
  console.warn('[db] permissions migration warning:', e.message);
}

// --- 迁移：plans / variants / scores 加代理身份字段（author_type / proxy_author_id / proxy_metadata）---
// 用于标记"小合代笔"：author_type='ai' 且 proxy_author_id 记录委托者 username
try {
  const proxyCols = [
    ['author_type', "TEXT DEFAULT 'human'"],
    ['proxy_author_id', "TEXT DEFAULT NULL"],
    ['proxy_metadata', "TEXT DEFAULT NULL"],
  ];
  for (const table of ['plans', 'variants', 'scores']) {
    const existing = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    for (const [col, type] of proxyCols) {
      if (!existing.includes(col)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
        console.log(`[db] Migrated: added column ${table}.${col}`);
      }
    }
  }
} catch (e) {
  console.warn('[db] proxy fields migration warning:', e.message);
}

// --- 迁移：notification_hooks 表（钩子驱动通知系统） ---
// 每条钩子由 3 个来源产生（deadline/patrol/admin_verbal），pending_confirm → admin 批 → active → fired
// 独立计数表 hook_id_counter 生成短 id（h001, h002...），方便 admin 口头取消
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_hooks (
      id TEXT PRIMARY KEY,
      plan_id TEXT,
      target_user TEXT NOT NULL,
      fire_at TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_confirm'
        CHECK(status IN ('pending_confirm', 'active', 'fired', 'cancelled', 'expired')),
      source TEXT NOT NULL
        CHECK(source IN ('deadline', 'patrol', 'admin_verbal')),
      created_at TEXT DEFAULT (datetime('now')),
      created_by TEXT NOT NULL,
      confirmed_at TEXT,
      confirmed_by TEXT,
      fired_at TEXT,
      reminder_count INTEGER NOT NULL DEFAULT 0,
      last_reminded_at TEXT,
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_hooks_status_fire ON notification_hooks(status, fire_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_hooks_plan ON notification_hooks(plan_id)');

  db.exec(`
    CREATE TABLE IF NOT EXISTS hook_id_counter (
      key TEXT PRIMARY KEY,
      next_val INTEGER NOT NULL
    )
  `);
  db.prepare('INSERT OR IGNORE INTO hook_id_counter (key, next_val) VALUES (?, ?)').run('hook', 1);
} catch (e) {
  console.warn('[db] notification_hooks migration warning:', e.message);
}

console.log(`[db] SQLite ready at ${DB_PATH}`);

export default db;
