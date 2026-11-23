import {
  parseCategoryId,
  parseIsoTimestamp,
  parseReceiptUri,
  parseRecurringRuleId,
  parseTransactionId,
  type AppSettings,
  type Category,
  type CategoryId,
  type IsoDate,
  type IsoTimestamp,
  type MonthSummary,
  type PositiveMinorUnits,
  type RecurringRule,
  type RecurringRuleId,
  type Transaction,
  type TransactionId,
  type TransactionType,
  type ValidatedCategoryDraft,
  type ValidatedTransactionDraft,
  type YearMonth,
} from '../types/domain';
import { clampDayToMonth, stepYearMonth } from '../utils/date';
import { summarizeMonth } from '../utils/money';
import {
  parseCategoryRow,
  parseCountRow,
  parseRecurringRuleRow,
  parseRecurringSkipRow,
  parseSettingsRow,
  parseTransactionRow,
  parseUserVersionRow,
} from './parsers';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_CATEGORY_IDS,
  FALLBACK_CATEGORY_ID,
  SCHEMA_V1_DDL,
  applyMigrationV2,
  applyMigrationV3,
  insertDefaultCategories,
  insertDefaultSettings,
  type SqlExecutor,
} from './schema';
import { resetDevSeed as resetDevSeedData, seedDevSampleData } from './seed';

export interface RecurringRuleDraft {
  readonly id?: RecurringRuleId;
  readonly type: TransactionType;
  readonly amount: PositiveMinorUnits;
  readonly categoryId: CategoryId;
  readonly dayOfMonth: number;
  readonly note: string;
  readonly startMonth: YearMonth;
  readonly isActive: boolean;
}

export interface DeleteCategoryResult {
  readonly reassignedTransactions: number;
  readonly reassignedRules: number;
}

export type SettingsUpdatePatch = Partial<
  Pick<AppSettings, 'currency' | 'carryOverEnabled' | 'theme'>
>;

export interface BudgetStore {
  getRevision(): number;
  subscribe(listener: () => void): () => void;
  getMonthSummary(month: YearMonth): MonthSummary;
  getTransaction(id: TransactionId): Transaction | null;
  getAllTransactions(): readonly Transaction[];
  getTransactionCount(): number;
  getCategories(): readonly Category[];
  getSettings(): AppSettings;
  getRecurringRules(): readonly RecurringRule[];
  saveTransaction(draft: ValidatedTransactionDraft): Transaction;
  deleteTransaction(id: TransactionId): Transaction | null;
  restoreTransaction(transaction: Transaction): Transaction;
  saveCategory(draft: ValidatedCategoryDraft): Category;
  deleteCategory(id: CategoryId): DeleteCategoryResult;
  updateSettings(patch: SettingsUpdatePatch): AppSettings;
  saveRecurringRule(draft: RecurringRuleDraft): RecurringRule;
  deleteRecurringRule(id: RecurringRuleId): void;
  materializeRecurringThrough(targetMonth: YearMonth): number;
  resetDevSeed(referenceDate?: IsoDate): void;
}

let idCounter = 0;

function generateUniqueSuffix(): string {
  idCounter += 1;
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  const timePart = Date.now().toString(36);
  const counterPart = idCounter.toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${timePart}_${counterPart}_${randomPart}`;
}

function createTransactionId(): TransactionId {
  const id = parseTransactionId(`tx_${generateUniqueSuffix()}`);
  if (id === null) {
    throw new Error('Failed to generate TransactionId');
  }
  return id;
}

function createCategoryId(): CategoryId {
  const id = parseCategoryId(`cat_${generateUniqueSuffix()}`);
  if (id === null) {
    throw new Error('Failed to generate CategoryId');
  }
  return id;
}

function createRecurringRuleId(): RecurringRuleId {
  const id = parseRecurringRuleId(`rec_${generateUniqueSuffix()}`);
  if (id === null) {
    throw new Error('Failed to generate RecurringRuleId');
  }
  return id;
}

function nowIsoTimestamp(): IsoTimestamp {
  const ts = parseIsoTimestamp(new Date().toISOString());
  if (ts === null) {
    throw new Error('Failed to generate IsoTimestamp');
  }
  return ts;
}

function readUserVersion(db: SqlExecutor): number {
  const row = db.getFirstSync<unknown>('PRAGMA user_version', []);
  return row === null ? 0 : parseUserVersionRow(row);
}

export function initDatabase(
  db: SqlExecutor,
  options?: { readonly seedDevData?: boolean; readonly referenceDate?: IsoDate },
): void {
  db.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

  const currentVersion = readUserVersion(db);
  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    db.withTransactionSync(() => {
      const versionInTx = readUserVersion(db);
      if (versionInTx < 1) {
        db.execSync(SCHEMA_V1_DDL);
        insertDefaultCategories(db);
        insertDefaultSettings(db);
        db.execSync('PRAGMA user_version = 1;');
      }
      if (versionInTx < 2) {
        applyMigrationV2(db);
        db.execSync('PRAGMA user_version = 2;');
      }
      if (versionInTx < 3) {
        applyMigrationV3(db);
        db.execSync('PRAGMA user_version = 3;');
      }
    });
  }

  if (options?.seedDevData) {
    seedDevSampleData(db, options.referenceDate);
  }
}

export function createBudgetStore(db: SqlExecutor): BudgetStore {
  let revision = 0;
  let cachedCategories: readonly Category[] | null = null;
  let cachedSettings: AppSettings | null = null;
  let cachedAllTransactions: readonly Transaction[] | null = null;
  let cachedTransactionCount: number | null = null;
  let cachedRecurringRules: readonly RecurringRule[] | null = null;
  const cachedMonthSummaries = new Map<YearMonth, MonthSummary>();
  const cachedTransactionsById = new Map<TransactionId, Transaction | null>();
  const listeners = new Set<() => void>();

  function clearAllCaches(): void {
    cachedCategories = null;
    cachedSettings = null;
    cachedAllTransactions = null;
    cachedTransactionCount = null;
    cachedRecurringRules = null;
    cachedMonthSummaries.clear();
    cachedTransactionsById.clear();
  }

  function invalidateTransactionCaches(): void {
    cachedAllTransactions = null;
    cachedTransactionCount = null;
    cachedTransactionsById.clear();
    cachedMonthSummaries.clear();
  }

  function bumpRevisionAndNotify(): void {
    revision += 1;
    for (const listener of listeners) {
      listener();
    }
  }

  function querySettings(): AppSettings {
    const row = db.getFirstSync<unknown>(
      'SELECT currency, carry_over_enabled, theme, dev_seeded FROM settings WHERE id = 1',
      [],
    );
    if (row === null) {
      throw new Error('Settings row (id = 1) is missing; call initDatabase first');
    }
    return parseSettingsRow(row);
  }

  function queryCategories(): readonly Category[] {
    const rows = db.getAllSync<unknown>(
      `
      SELECT id, name, type, icon, color, is_default, monthly_budget, sort_order
      FROM categories
      ORDER BY type ASC, sort_order ASC, name ASC
      `,
      [],
    );
    return rows.map(parseCategoryRow);
  }

  function queryAllTransactions(): readonly Transaction[] {
    const rows = db.getAllSync<unknown>(
      `
      SELECT id, type, amount, category_id, date, note, created_at, recurring_rule_id, recurring_month, receipt_uri
      FROM transactions
      ORDER BY date DESC, created_at DESC, id DESC
      `,
      [],
    );
    return rows.map(parseTransactionRow);
  }

  function queryTransactionCount(): number {
    const row = db.getFirstSync<unknown>(
      'SELECT COUNT(*) AS count FROM transactions',
      [],
    );
    return row === null ? 0 : parseCountRow(row);
  }

  function queryTransactionById(id: TransactionId): Transaction | null {
    const row = db.getFirstSync<unknown>(
      `
      SELECT id, type, amount, category_id, date, note, created_at, recurring_rule_id, recurring_month, receipt_uri
      FROM transactions
      WHERE id = ?
      `,
      [id],
    );
    return row === null ? null : parseTransactionRow(row);
  }

  function queryRecurringRules(): readonly RecurringRule[] {
    const rows = db.getAllSync<unknown>(
      `
      SELECT id, type, amount, category_id, day_of_month, note, start_month, is_active, created_at
      FROM recurring_rules
      ORDER BY created_at DESC, id DESC
      `,
      [],
    );
    return rows.map(parseRecurringRuleRow);
  }

  function getSettings(): AppSettings {
    if (cachedSettings === null) {
      cachedSettings = querySettings();
    }
    return cachedSettings;
  }

  function getCategories(): readonly Category[] {
    if (cachedCategories === null) {
      cachedCategories = queryCategories();
    }
    return cachedCategories;
  }

  function getAllTransactions(): readonly Transaction[] {
    if (cachedAllTransactions === null) {
      cachedAllTransactions = queryAllTransactions();
    }
    return cachedAllTransactions;
  }

  function getTransactionCount(): number {
    if (cachedTransactionCount === null) {
      cachedTransactionCount =
        cachedAllTransactions !== null
          ? cachedAllTransactions.length
          : queryTransactionCount();
    }
    return cachedTransactionCount;
  }

  function getTransaction(id: TransactionId): Transaction | null {
    if (cachedTransactionsById.has(id)) {
      return cachedTransactionsById.get(id) ?? null;
    }
    const found = queryTransactionById(id);
    cachedTransactionsById.set(id, found);
    return found;
  }

  function getRecurringRules(): readonly RecurringRule[] {
    if (cachedRecurringRules === null) {
      cachedRecurringRules = queryRecurringRules();
    }
    return cachedRecurringRules;
  }

  function getMonthSummary(month: YearMonth): MonthSummary {
    const cached = cachedMonthSummaries.get(month);
    if (cached) {
      return cached;
    }
    const allTransactions = getAllTransactions();
    const categories = getCategories();
    const settings = getSettings();
    const summary = summarizeMonth(month, allTransactions, categories, settings.carryOverEnabled);
    cachedMonthSummaries.set(month, summary);
    return summary;
  }

  function saveTransaction(draft: ValidatedTransactionDraft): Transaction {
    const receiptResult = parseReceiptUri(draft.receiptUri);
    if (!receiptResult.ok) {
      throw new Error('Invalid receipt URI in transaction draft');
    }
    const receiptUri = receiptResult.value;
    let savedId: TransactionId | null = null;

    db.withTransactionSync(() => {
      if (draft.id !== undefined) {
        const existing = queryTransactionById(draft.id);
        if (existing === null) {
          throw new Error(`Transaction not found: ${draft.id}`);
        }
        db.runSync(
          `
          UPDATE transactions
          SET type = ?, amount = ?, category_id = ?, date = ?, note = ?, receipt_uri = ?
          WHERE id = ?
          `,
          [
            draft.type,
            draft.amount,
            draft.categoryId,
            draft.date,
            draft.note,
            receiptUri,
            draft.id,
          ],
        );
        savedId = draft.id;
      } else {
        const newId = createTransactionId();
        db.runSync(
          `
          INSERT INTO transactions (
            id, type, amount, category_id, date, note, created_at, recurring_rule_id, recurring_month, receipt_uri
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
          `,
          [
            newId,
            draft.type,
            draft.amount,
            draft.categoryId,
            draft.date,
            draft.note,
            nowIsoTimestamp(),
            receiptUri,
          ],
        );
        savedId = newId;
      }
    });

    if (savedId === null) {
      throw new Error('Failed to persist transaction');
    }
    const saved = queryTransactionById(savedId);
    if (saved === null) {
      throw new Error('Failed to load saved transaction');
    }
    invalidateTransactionCaches();
    bumpRevisionAndNotify();
    return saved;
  }

  function deleteTransaction(id: TransactionId): Transaction | null {
    let deleted: Transaction | null = null;
    db.withTransactionSync(() => {
      const existing = queryTransactionById(id);
      if (existing === null) {
        return;
      }
      db.runSync('DELETE FROM transactions WHERE id = ?', [id]);
      if (existing.recurringRuleId !== null && existing.recurringMonth !== null) {
        db.runSync(
          'INSERT OR IGNORE INTO recurring_skips (recurring_rule_id, recurring_month) VALUES (?, ?)',
          [existing.recurringRuleId, existing.recurringMonth],
        );
      }
      deleted = existing;
    });

    if (deleted !== null) {
      invalidateTransactionCaches();
      bumpRevisionAndNotify();
    }
    return deleted;
  }

  function restoreTransaction(transaction: Transaction): Transaction {
    const receiptResult = parseReceiptUri(transaction.receiptUri);
    if (!receiptResult.ok) {
      throw new Error('Invalid receipt URI in transaction to restore');
    }

    db.withTransactionSync(() => {
      const alreadyExists = queryTransactionById(transaction.id);
      if (alreadyExists !== null) {
        return;
      }

      const categoryExistsRow = db.getFirstSync<unknown>(
        'SELECT COUNT(*) AS count FROM categories WHERE id = ? AND type = ?',
        [transaction.categoryId, transaction.type],
      );
      const hasCategory =
        categoryExistsRow !== null && parseCountRow(categoryExistsRow) > 0;
      const targetCategoryId = hasCategory
        ? transaction.categoryId
        : FALLBACK_CATEGORY_ID[transaction.type];

      let targetRecurringRuleId: RecurringRuleId | null = transaction.recurringRuleId;
      let targetRecurringMonth: YearMonth | null = transaction.recurringMonth;
      if (targetRecurringRuleId !== null) {
        const ruleExistsRow = db.getFirstSync<unknown>(
          'SELECT COUNT(*) AS count FROM recurring_rules WHERE id = ?',
          [targetRecurringRuleId],
        );
        const hasRule = ruleExistsRow !== null && parseCountRow(ruleExistsRow) > 0;
        if (!hasRule) {
          targetRecurringRuleId = null;
          targetRecurringMonth = null;
        }
      }

      db.runSync(
        `
        INSERT OR IGNORE INTO transactions (
          id, type, amount, category_id, date, note, created_at, recurring_rule_id, recurring_month, receipt_uri
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          transaction.id,
          transaction.type,
          transaction.amount,
          targetCategoryId,
          transaction.date,
          transaction.note,
          transaction.createdAt,
          targetRecurringRuleId,
          targetRecurringMonth,
          receiptResult.value,
        ],
      );

      if (targetRecurringRuleId !== null && targetRecurringMonth !== null) {
        db.runSync(
          'DELETE FROM recurring_skips WHERE recurring_rule_id = ? AND recurring_month = ?',
          [targetRecurringRuleId, targetRecurringMonth],
        );
      }
    });

    const restored = queryTransactionById(transaction.id);
    if (restored === null) {
      throw new Error(`Failed to restore transaction: ${transaction.id}`);
    }
    invalidateTransactionCaches();
    bumpRevisionAndNotify();
    return restored;
  }

  function saveCategory(draft: ValidatedCategoryDraft): Category {
    let savedId: CategoryId | null = null;
    const budgetValue = draft.type === 'expense' ? draft.monthlyBudget : null;

    db.withTransactionSync(() => {
      if (draft.id !== undefined) {
        const existingRow = db.getFirstSync<unknown>(
          `
          SELECT id, name, type, icon, color, is_default, monthly_budget, sort_order
          FROM categories
          WHERE id = ?
          `,
          [draft.id],
        );
        if (existingRow === null) {
          throw new Error(`Category not found: ${draft.id}`);
        }
        const existing = parseCategoryRow(existingRow);
        if (existing.type !== draft.type) {
          throw new Error('Cannot change category type');
        }
        db.runSync(
          `
          UPDATE categories
          SET name = ?, icon = ?, color = ?, monthly_budget = ?
          WHERE id = ?
          `,
          [draft.name, draft.icon, draft.color, budgetValue, draft.id],
        );
        savedId = draft.id;
      } else {
        const newId = createCategoryId();
        const maxSortRow = db.getFirstSync<unknown>(
          'SELECT COALESCE(MAX(sort_order), 0) AS count FROM categories WHERE type = ?',
          [draft.type],
        );
        const nextSortOrder = (maxSortRow === null ? 0 : parseCountRow(maxSortRow)) + 1;
        db.runSync(
          `
          INSERT INTO categories (
            id, name, type, icon, color, is_default, monthly_budget, sort_order
          ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
          `,
          [newId, draft.name, draft.type, draft.icon, draft.color, budgetValue, nextSortOrder],
        );
        savedId = newId;
      }
    });

    if (savedId === null) {
      throw new Error('Failed to persist category');
    }
    const savedRow = db.getFirstSync<unknown>(
      `
      SELECT id, name, type, icon, color, is_default, monthly_budget, sort_order
      FROM categories
      WHERE id = ?
      `,
      [savedId],
    );
    if (savedRow === null) {
      throw new Error('Failed to load saved category');
    }
    cachedCategories = null;
    cachedMonthSummaries.clear();
    bumpRevisionAndNotify();
    return parseCategoryRow(savedRow);
  }

  function deleteCategory(id: CategoryId): DeleteCategoryResult {
    let result: DeleteCategoryResult = { reassignedTransactions: 0, reassignedRules: 0 };

    db.withTransactionSync(() => {
      const row = db.getFirstSync<unknown>(
        `
        SELECT id, name, type, icon, color, is_default, monthly_budget, sort_order
        FROM categories
        WHERE id = ?
        `,
        [id],
      );
      if (row === null) {
        throw new Error(`Category not found: ${id}`);
      }
      const category = parseCategoryRow(row);
      if (category.isDefault || DEFAULT_CATEGORY_IDS.has(category.id)) {
        throw new Error('Default categories cannot be deleted');
      }

      const fallbackId = FALLBACK_CATEGORY_ID[category.type];
      const txUpdate = db.runSync(
        'UPDATE transactions SET category_id = ? WHERE category_id = ? AND type = ?',
        [fallbackId, category.id, category.type],
      );
      const ruleUpdate = db.runSync(
        'UPDATE recurring_rules SET category_id = ? WHERE category_id = ? AND type = ?',
        [fallbackId, category.id, category.type],
      );
      db.runSync('DELETE FROM categories WHERE id = ?', [category.id]);

      result = {
        reassignedTransactions: txUpdate.changes,
        reassignedRules: ruleUpdate.changes,
      };
    });

    cachedCategories = null;
    invalidateTransactionCaches();
    cachedRecurringRules = null;
    bumpRevisionAndNotify();
    return result;
  }

  function updateSettings(patch: SettingsUpdatePatch): AppSettings {
    const current = querySettings();
    const nextCurrency = patch.currency ?? current.currency;
    const nextCarryOver = patch.carryOverEnabled ?? current.carryOverEnabled;
    const nextTheme = patch.theme ?? current.theme;

    db.runSync(
      `
      UPDATE settings
      SET currency = ?, carry_over_enabled = ?, theme = ?
      WHERE id = 1
      `,
      [nextCurrency, nextCarryOver ? 1 : 0, nextTheme],
    );

    const updated = querySettings();
    cachedSettings = updated;
    if (nextCarryOver !== current.carryOverEnabled) {
      cachedMonthSummaries.clear();
    }
    bumpRevisionAndNotify();
    return updated;
  }

  function saveRecurringRule(draft: RecurringRuleDraft): RecurringRule {
    if (!Number.isSafeInteger(draft.dayOfMonth) || draft.dayOfMonth < 1 || draft.dayOfMonth > 31) {
      throw new RangeError(`Invalid dayOfMonth: ${draft.dayOfMonth}`);
    }
    const trimmedNote = draft.note.trim();
    let savedId: RecurringRuleId | null = null;

    db.withTransactionSync(() => {
      if (draft.id !== undefined) {
        const existingRow = db.getFirstSync<unknown>(
          `
          SELECT id, type, amount, category_id, day_of_month, note, start_month, is_active, created_at
          FROM recurring_rules
          WHERE id = ?
          `,
          [draft.id],
        );
        if (existingRow === null) {
          throw new Error(`Recurring rule not found: ${draft.id}`);
        }
        db.runSync(
          `
          UPDATE recurring_rules
          SET type = ?, amount = ?, category_id = ?, day_of_month = ?, note = ?, start_month = ?, is_active = ?
          WHERE id = ?
          `,
          [
            draft.type,
            draft.amount,
            draft.categoryId,
            draft.dayOfMonth,
            trimmedNote,
            draft.startMonth,
            draft.isActive ? 1 : 0,
            draft.id,
          ],
        );
        savedId = draft.id;
      } else {
        const newId = createRecurringRuleId();
        db.runSync(
          `
          INSERT INTO recurring_rules (
            id, type, amount, category_id, day_of_month, note, start_month, is_active, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            newId,
            draft.type,
            draft.amount,
            draft.categoryId,
            draft.dayOfMonth,
            trimmedNote,
            draft.startMonth,
            draft.isActive ? 1 : 0,
            nowIsoTimestamp(),
          ],
        );
        savedId = newId;
      }
    });

    if (savedId === null) {
      throw new Error('Failed to persist recurring rule');
    }
    const savedRow = db.getFirstSync<unknown>(
      `
      SELECT id, type, amount, category_id, day_of_month, note, start_month, is_active, created_at
      FROM recurring_rules
      WHERE id = ?
      `,
      [savedId],
    );
    if (savedRow === null) {
      throw new Error('Failed to load saved recurring rule');
    }
    cachedRecurringRules = null;
    bumpRevisionAndNotify();
    return parseRecurringRuleRow(savedRow);
  }

  function deleteRecurringRule(id: RecurringRuleId): void {
    const result = db.runSync('DELETE FROM recurring_rules WHERE id = ?', [id]);
    if (result.changes > 0) {
      cachedRecurringRules = null;
      invalidateTransactionCaches();
      bumpRevisionAndNotify();
    }
  }

  function materializeRecurringThrough(targetMonth: YearMonth): number {
    const activeRules = queryRecurringRules().filter(
      (rule) => rule.isActive && rule.startMonth <= targetMonth,
    );
    if (activeRules.length === 0) {
      return 0;
    }

    let insertedCount = 0;
    const insertSql = `
      INSERT OR IGNORE INTO transactions (
        id, type, amount, category_id, date, note, created_at, recurring_rule_id, recurring_month, receipt_uri
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `;

    db.withTransactionSync(() => {
      const skipRows = db.getAllSync<unknown>(
        'SELECT recurring_rule_id, recurring_month FROM recurring_skips',
        [],
      );
      const skippedKeys = new Set<string>();
      for (const row of skipRows) {
        const skip = parseRecurringSkipRow(row);
        skippedKeys.add(`${skip.recurringRuleId}|${skip.recurringMonth}`);
      }

      for (const rule of activeRules) {
        let monthCursor = rule.startMonth;
        while (monthCursor <= targetMonth) {
          if (!skippedKeys.has(`${rule.id}|${monthCursor}`)) {
            const date = clampDayToMonth(monthCursor, rule.dayOfMonth);
            const result = db.runSync(insertSql, [
              createTransactionId(),
              rule.type,
              rule.amount,
              rule.categoryId,
              date,
              rule.note,
              nowIsoTimestamp(),
              rule.id,
              monthCursor,
            ]);
            insertedCount += result.changes;
          }
          monthCursor = stepYearMonth(monthCursor, 1);
        }
      }
    });

    if (insertedCount > 0) {
      invalidateTransactionCaches();
      bumpRevisionAndNotify();
    }
    return insertedCount;
  }

  function resetDevSeed(referenceDate?: IsoDate): void {
    resetDevSeedData(db, referenceDate);
    clearAllCaches();
    bumpRevisionAndNotify();
  }

  return {
    getRevision: () => revision,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getMonthSummary,
    getTransaction,
    getAllTransactions,
    getTransactionCount,
    getCategories,
    getSettings,
    getRecurringRules,
    saveTransaction,
    deleteTransaction,
    restoreTransaction,
    saveCategory,
    deleteCategory,
    updateSettings,
    saveRecurringRule,
    deleteRecurringRule,
    materializeRecurringThrough,
    resetDevSeed,
  };
}
