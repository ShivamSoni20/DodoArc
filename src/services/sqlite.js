const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(dataDir, 'dodoarc.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

function connectDatabase(targetPath) {
  const database = new Database(targetPath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  return database;
}

function initializeSchema(sqlite) {
  sqlite.exec(`
  CREATE TABLE IF NOT EXISTS webhook_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    raw_body TEXT,
    status TEXT DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    action_taken TEXT,
    error_message TEXT,
    received_at TEXT DEFAULT CURRENT_TIMESTAMP,
    processed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    dodo_customer_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS developers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL,
    developer_id TEXT NOT NULL,
    name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT,
    FOREIGN KEY (developer_id) REFERENCES developers(id)
  );

  CREATE TABLE IF NOT EXISTS auth_accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    user_id TEXT,
    developer_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email, role),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (developer_id) REFERENCES developers(id)
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT UNIQUE NOT NULL,
    account_id TEXT NOT NULL,
    api_key TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES auth_accounts(id)
  );

  CREATE TABLE IF NOT EXISTS developer_apps (
    id TEXT PRIMARY KEY,
    developer_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    plan_id TEXT DEFAULT 'plan_pro',
    credits_per_run INTEGER DEFAULT 10,
    dodo_api_key TEXT,
    dodo_product_id TEXT,
    dodo_webhook_secret TEXT,
    billing_connected INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (developer_id) REFERENCES developers(id)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    developer_id TEXT,
    app_id TEXT,
    dodo_payment_id TEXT,
    dodo_subscription_id TEXT,
    status TEXT DEFAULT 'active',
    credits_total INTEGER DEFAULT 0,
    credits_used INTEGER DEFAULT 0,
    payment_method TEXT,
    last_payment_amount INTEGER,
    last_payment_currency TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    developer_id TEXT,
    app_id TEXT,
    data TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settlement_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_run_id TEXT,
    developer_id TEXT,
    app_id TEXT,
    tool_name TEXT,
    amount_usdc REAL,
    to_wallet TEXT,
    tx_signature TEXT,
    explorer_url TEXT,
    mock INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS agent_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT UNIQUE,
    user_id TEXT,
    developer_id TEXT,
    app_id TEXT,
    agent_name TEXT,
    credits_used INTEGER,
    status TEXT DEFAULT 'running',
    policy_applied TEXT,
    result TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS app_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id TEXT NOT NULL,
    developer_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(app_id, user_id),
    FOREIGN KEY (app_id) REFERENCES developer_apps(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS app_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id TEXT UNIQUE NOT NULL,
    developer_id TEXT NOT NULL,
    max_credits_per_run INTEGER DEFAULT 50,
    daily_spend_cap INTEGER DEFAULT 500,
    allowed_tools TEXT DEFAULT '["market-data","sentiment-feed","signal-engine"]',
    require_approval_above INTEGER DEFAULT 100,
    paused INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES developer_apps(id)
  );
`);

  const migrations = [
    'ALTER TABLE subscriptions ADD COLUMN developer_id TEXT',
    'ALTER TABLE subscriptions ADD COLUMN app_id TEXT',
    'ALTER TABLE agent_runs ADD COLUMN developer_id TEXT',
    'ALTER TABLE agent_runs ADD COLUMN app_id TEXT',
    'ALTER TABLE agent_runs ADD COLUMN policy_applied TEXT',
    'ALTER TABLE settlement_receipts ADD COLUMN developer_id TEXT',
    'ALTER TABLE settlement_receipts ADD COLUMN app_id TEXT',
    'ALTER TABLE events ADD COLUMN developer_id TEXT',
    'ALTER TABLE events ADD COLUMN app_id TEXT',
    'ALTER TABLE developer_apps ADD COLUMN dodo_api_key TEXT',
    'ALTER TABLE developer_apps ADD COLUMN dodo_product_id TEXT',
    'ALTER TABLE developer_apps ADD COLUMN dodo_webhook_secret TEXT',
    'ALTER TABLE developer_apps ADD COLUMN billing_connected INTEGER DEFAULT 0'
  ];

  for (const migration of migrations) {
    try {
      sqlite.exec(migration);
    } catch {
      // column already exists
    }
  }
}

let sqlite;
try {
  sqlite = connectDatabase(dbPath);
  initializeSchema(sqlite);
  // A successful open is not enough on this Windows sandbox. Acquire a
  // write lock once so we can fall back before the first real mutation.
  sqlite.exec('BEGIN IMMEDIATE; ROLLBACK;');
} catch {
  try {
    const runtimePath = path.join(dataDir, 'dodoarc-runtime.db');
    sqlite = connectDatabase(runtimePath);
    initializeSchema(sqlite);
  } catch {
    sqlite = connectDatabase(':memory:');
    initializeSchema(sqlite);
  }
}
module.exports = sqlite;
