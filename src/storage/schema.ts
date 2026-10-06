/** Versioned schema SQL. Migration 1 is the pre–Milestone A schema. */

export const SCHEMA_VERSION_KEY = 'schema_version'
export const LATEST_SCHEMA_VERSION = 2

/** CREATE TABLE IF NOT EXISTS for every table that existed before Milestone A. */
export const V1_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  on_budget INTEGER NOT NULL,
  closed INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS category_groups (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  kind TEXT NOT NULL DEFAULT 'normal',
  account_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS payees (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  name TEXT NOT NULL,
  transfer_account_id TEXT,
  last_category_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  date TEXT NOT NULL,
  payee_id TEXT,
  category_id TEXT,
  memo TEXT,
  amount_centavos INTEGER NOT NULL,
  cleared TEXT NOT NULL DEFAULT 'uncleared',
  approved INTEGER NOT NULL DEFAULT 1,
  transfer_transaction_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS assignment_entries (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  month TEXT NOT NULL,
  delta_centavos INTEGER NOT NULL,
  move_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS pins (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS month_notes (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  month TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
`

/** New tables for Milestone A (targets, snoozes, moves, settings). */
export const V2_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS targets (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  cadence TEXT NOT NULL,
  behavior TEXT NOT NULL,
  amount_centavos INTEGER NOT NULL,
  weekday INTEGER,
  due_day TEXT,
  due_month TEXT,
  repeat TEXT,
  repeat_behavior TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS targets_one_active
  ON targets(budget_id, category_id) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS target_snoozes (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  month TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS target_snoozes_one_active
  ON target_snoozes(budget_id, category_id, month) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS moves (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  month TEXT NOT NULL,
  undone_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS budget_settings (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS budget_settings_one_active
  ON budget_settings(budget_id, key) WHERE deleted_at IS NULL;
`
