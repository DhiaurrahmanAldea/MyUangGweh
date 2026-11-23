import {
  parseCategoryId,
  parseHexColor,
  type Category,
  type CategoryIcon,
  type CategoryId,
  type ExpenseCategory,
  type HexColor,
  type IncomeCategory,
  type TransactionType,
} from '../types/domain';
import { parseTableInfoColumnName } from './parsers';

export type SqlParam = string | number | null;

export interface SqlRunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface SqlExecutor {
  execSync(source: string): void;
  runSync(source: string, params: SqlParam[]): SqlRunResult;
  getFirstSync<T>(source: string, params: SqlParam[]): T | null;
  getAllSync<T>(source: string, params: SqlParam[]): T[];
  withTransactionSync(task: () => void): void;
}

export const CURRENT_SCHEMA_VERSION = 3;

function requireCategoryId(value: string): CategoryId {
  const parsed = parseCategoryId(value);
  if (parsed === null) {
    throw new Error(`Invalid built-in category ID: ${value}`);
  }
  return parsed;
}

function requireHexColor(value: string): HexColor {
  const parsed = parseHexColor(value);
  if (parsed === null) {
    throw new Error(`Invalid built-in hex color: ${value}`);
  }
  return parsed;
}

function makeDefaultExpenseCategory(
  id: string,
  name: string,
  icon: CategoryIcon,
  color: string,
  sortOrder: number,
): ExpenseCategory {
  return {
    id: requireCategoryId(id),
    name,
    type: 'expense',
    icon,
    color: requireHexColor(color),
    isDefault: true,
    monthlyBudget: null,
    sortOrder,
  };
}

function makeDefaultIncomeCategory(
  id: string,
  name: string,
  icon: CategoryIcon,
  color: string,
  sortOrder: number,
): IncomeCategory {
  return {
    id: requireCategoryId(id),
    name,
    type: 'income',
    icon,
    color: requireHexColor(color),
    isDefault: true,
    sortOrder,
  };
}

const EXPENSE_FOOD_ID = requireCategoryId('cat_expense_food');
const EXPENSE_TRANSPORT_ID = requireCategoryId('cat_expense_transport');
const EXPENSE_BILLS_ID = requireCategoryId('cat_expense_bills');
const EXPENSE_SHOPPING_ID = requireCategoryId('cat_expense_shopping');
const EXPENSE_HEALTH_ID = requireCategoryId('cat_expense_health');
const EXPENSE_ENTERTAINMENT_ID = requireCategoryId('cat_expense_entertainment');
const EXPENSE_OTHER_ID = requireCategoryId('cat_expense_other');

const INCOME_SALARY_ID = requireCategoryId('cat_income_salary');
const INCOME_BUSINESS_ID = requireCategoryId('cat_income_business');
const INCOME_GIFT_ID = requireCategoryId('cat_income_gift');
const INCOME_OTHER_ID = requireCategoryId('cat_income_other');

export const FALLBACK_CATEGORY_ID: Readonly<Record<TransactionType, CategoryId>> = {
  expense: EXPENSE_OTHER_ID,
  income: INCOME_OTHER_ID,
};

export const DEFAULT_CATEGORIES: readonly Category[] = [
  makeDefaultExpenseCategory(EXPENSE_FOOD_ID, 'Food', 'restaurant-outline', '#EA580C', 1),
  makeDefaultExpenseCategory(EXPENSE_TRANSPORT_ID, 'Transport', 'car-outline', '#0284C7', 2),
  makeDefaultExpenseCategory(EXPENSE_BILLS_ID, 'Bills', 'receipt-outline', '#7C3AED', 3),
  makeDefaultExpenseCategory(EXPENSE_SHOPPING_ID, 'Shopping', 'bag-handle-outline', '#DB2777', 4),
  makeDefaultExpenseCategory(EXPENSE_HEALTH_ID, 'Health', 'heart-outline', '#DC2626', 5),
  makeDefaultExpenseCategory(
    EXPENSE_ENTERTAINMENT_ID,
    'Entertainment',
    'film-outline',
    '#9333EA',
    6,
  ),
  makeDefaultExpenseCategory(
    EXPENSE_OTHER_ID,
    'Other',
    'ellipsis-horizontal-circle-outline',
    '#64748B',
    7,
  ),
  makeDefaultIncomeCategory(INCOME_SALARY_ID, 'Salary', 'wallet-outline', '#059669', 1),
  makeDefaultIncomeCategory(INCOME_BUSINESS_ID, 'Business', 'briefcase-outline', '#0F766E', 2),
  makeDefaultIncomeCategory(INCOME_GIFT_ID, 'Gift', 'gift-outline', '#D97706', 3),
  makeDefaultIncomeCategory(
    INCOME_OTHER_ID,
    'Other',
    'ellipsis-horizontal-circle-outline',
    '#64748B',
    4,
  ),
];

export const DEFAULT_CATEGORY_IDS: ReadonlySet<CategoryId> = new Set(
  DEFAULT_CATEGORIES.map((category) => category.id),
);

export const SCHEMA_V1_DDL = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT NOT NULL,
  color TEXT NOT NULL CHECK (color LIKE '#______' AND length(color) = 7),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  monthly_budget INTEGER CHECK (monthly_budget IS NULL OR monthly_budget > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (id, type),
  CHECK (type = 'expense' OR monthly_budget IS NULL)
);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  category_id TEXT NOT NULL,
  day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
  note TEXT NOT NULL DEFAULT '',
  start_month TEXT NOT NULL CHECK (start_month LIKE '____-__' AND length(start_month) = 7),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (category_id, type) REFERENCES categories(id, type) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  category_id TEXT NOT NULL,
  date TEXT NOT NULL CHECK (date LIKE '____-__-__' AND length(date) = 10),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  recurring_rule_id TEXT REFERENCES recurring_rules(id) ON DELETE SET NULL,
  recurring_month TEXT CHECK (recurring_month IS NULL OR (recurring_month LIKE '____-__' AND length(recurring_month) = 7)),
  FOREIGN KEY (category_id, type) REFERENCES categories(id, type) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  currency TEXT NOT NULL DEFAULT 'IDR' CHECK (currency IN ('IDR', 'USD', 'EUR', 'SGD', 'GBP', 'JPY')),
  carry_over_enabled INTEGER NOT NULL DEFAULT 0 CHECK (carry_over_enabled IN (0, 1)),
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  dev_seeded INTEGER NOT NULL DEFAULT 0 CHECK (dev_seeded IN (0, 1))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_type_name ON categories(type, lower(name));
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_recurring_unique
  ON transactions(recurring_rule_id, recurring_month)
  WHERE recurring_rule_id IS NOT NULL AND recurring_month IS NOT NULL;
`;

export const SCHEMA_V2_MIGRATION_SQL =
  'ALTER TABLE transactions ADD COLUMN receipt_uri TEXT NULL;';

export function applyMigrationV2(db: SqlExecutor): void {
  const columns = db.getAllSync<unknown>('PRAGMA table_info(transactions)', []);
  const hasReceiptUri = columns.some(
    (row) => parseTableInfoColumnName(row) === 'receipt_uri',
  );
  if (!hasReceiptUri) {
    db.execSync(SCHEMA_V2_MIGRATION_SQL);
  }
}

export const SCHEMA_V3_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS recurring_skips (
  recurring_rule_id TEXT NOT NULL REFERENCES recurring_rules(id) ON DELETE CASCADE,
  recurring_month TEXT NOT NULL CHECK (recurring_month LIKE '____-__' AND length(recurring_month) = 7),
  PRIMARY KEY (recurring_rule_id, recurring_month)
);
`;

export function applyMigrationV3(db: SqlExecutor): void {
  db.execSync(SCHEMA_V3_MIGRATION_SQL);
}

export function insertDefaultCategories(db: SqlExecutor): void {
  const sql = `
    INSERT OR IGNORE INTO categories (
      id, name, type, icon, color, is_default, monthly_budget, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  for (const category of DEFAULT_CATEGORIES) {
    const monthlyBudget = category.type === 'expense' ? category.monthlyBudget : null;
    db.runSync(sql, [
      category.id,
      category.name,
      category.type,
      category.icon,
      category.color,
      category.isDefault ? 1 : 0,
      monthlyBudget,
      category.sortOrder,
    ]);
  }
}

export function insertDefaultSettings(db: SqlExecutor): void {
  db.runSync(
    `
    INSERT OR IGNORE INTO settings (id, currency, carry_over_enabled, theme, dev_seeded)
    VALUES (1, 'IDR', 0, 'system', 0)
    `,
    [],
  );
}
