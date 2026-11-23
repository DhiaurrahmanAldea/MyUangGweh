/// <reference types="node" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  parseTableInfoColumnName,
  parseTransactionRow,
} from './parsers';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_CATEGORIES,
  FALLBACK_CATEGORY_ID,
  SCHEMA_V1_DDL,
  applyMigrationV2,
  applyMigrationV3,
  insertDefaultCategories,
  insertDefaultSettings,
  type SqlExecutor,
  type SqlParam,
} from './schema';
import { seedDevSampleData } from './seed';
import { createBudgetStore, initDatabase } from './store';
import {
  parseCategoryDraft,
  parseCategoryId,
  parseIsoDate,
  parsePositiveMinorUnits,
  parseTransactionDraft,
  parseYearMonth,
  type CategoryId,
  type IsoDate,
  type PositiveMinorUnits,
  type TransactionId,
  type YearMonth,
} from '../types/domain';

function createSqliteExecutor(db: DatabaseSync): SqlExecutor {
  return {
    execSync(source) {
      db.exec(source);
    },
    runSync(source, params: SqlParam[]) {
      const stmt = db.prepare(source);
      const result = stmt.run(...params);
      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowid),
      };
    },
    getFirstSync<T>(source: string, params: SqlParam[]): T | null {
      const stmt = db.prepare(source);
      const row = stmt.get(...params);
      return row === undefined ? null : (row as T);
    },
    getAllSync<T>(source: string, params: SqlParam[]): T[] {
      const stmt = db.prepare(source);
      return stmt.all(...params) as T[];
    },
    withTransactionSync(task) {
      db.exec('BEGIN');
      try {
        task();
        db.exec('COMMIT');
      } catch (error) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // Preserve the original failure when SQLite already rolled back.
        }
        throw error;
      }
    },
  };
}

function mustIsoDate(value: string): IsoDate {
  const parsed = parseIsoDate(value);
  if (parsed === null) {
    throw new Error(`Expected valid IsoDate: ${value}`);
  }
  return parsed;
}

function mustYearMonth(value: string): YearMonth {
  const parsed = parseYearMonth(value);
  if (parsed === null) {
    throw new Error(`Expected valid YearMonth: ${value}`);
  }
  return parsed;
}

function mustCatId(value: string): CategoryId {
  const parsed = parseCategoryId(value);
  if (parsed === null) {
    throw new Error(`Expected valid CategoryId: ${value}`);
  }
  return parsed;
}

function mustPos(value: number): PositiveMinorUnits {
  const parsed = parsePositiveMinorUnits(value);
  if (parsed === null) {
    throw new Error(`Expected valid PositiveMinorUnits: ${value}`);
  }
  return parsed;
}

test('schema initialization is idempotent and seeds defaults cleanly', () => {
  const rawDb = new DatabaseSync(':memory:');
  try {
    const db = createSqliteExecutor(rawDb);
    initDatabase(db, { seedDevData: false });
    initDatabase(db, { seedDevData: false });

    const versionRow = db.getFirstSync<{ user_version: number }>('PRAGMA user_version', []);
    assert.equal(versionRow?.user_version, CURRENT_SCHEMA_VERSION);
    assert.equal(versionRow?.user_version, 3);

    const store = createBudgetStore(db);
    const categories = store.getCategories();
    assert.equal(categories.length, DEFAULT_CATEGORIES.length);
    assert.equal(categories.filter((c) => c.type === 'expense').length, 7);
    assert.equal(categories.filter((c) => c.type === 'income').length, 4);

    const settings = store.getSettings();
    assert.deepEqual(settings, {
      currency: 'IDR',
      carryOverEnabled: false,
      theme: 'system',
      devSeeded: false,
    });
  } finally {
    rawDb.close();
  }
});

test('real SQLite file persists transactions, custom categories, and settings across close and reopen', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pocket-ledger-test-'));
  const dbPath = path.join(tempDir, 'ledger.db');

  try {
    const db1 = new DatabaseSync(dbPath);
    let savedTxId = '';
    let customCatId = '';
    try {
      const exec1 = createSqliteExecutor(db1);
      initDatabase(exec1, { seedDevData: false });
      const store1 = createBudgetStore(exec1);

      const catDraft = parseCategoryDraft(
        {
          type: 'expense',
          name: 'Coffee',
          icon: 'cafe-outline',
          color: '#78350F',
          monthlyBudgetText: '500000',
          currency: 'IDR',
        },
        store1.getCategories(),
      );
      assert.equal(catDraft.ok, true);
      if (!catDraft.ok) {
        return;
      }
      const savedCategory = store1.saveCategory(catDraft.value);
      customCatId = savedCategory.id;

      const txDraft = parseTransactionDraft(
        {
          type: 'expense',
          amountText: '45000',
          categoryId: savedCategory.id,
          date: '2026-11-22',
          note: 'Pour over coffee',
          currency: 'IDR',
        },
        store1.getCategories(),
      );
      assert.equal(txDraft.ok, true);
      if (!txDraft.ok) {
        return;
      }
      const savedTx = store1.saveTransaction(txDraft.value);
      savedTxId = savedTx.id;

      store1.updateSettings({ currency: 'USD', carryOverEnabled: true, theme: 'dark' });
    } finally {
      db1.close();
    }

    const db2 = new DatabaseSync(dbPath);
    try {
      const exec2 = createSqliteExecutor(db2);
      initDatabase(exec2, { seedDevData: false });
      const store2 = createBudgetStore(exec2);

      assert.deepEqual(store2.getSettings(), {
        currency: 'USD',
        carryOverEnabled: true,
        theme: 'dark',
        devSeeded: false,
      });

      const reloadedCat = store2.getCategories().find((c) => c.id === customCatId);
      if (!reloadedCat) {
        assert.fail('Expected Coffee category to reload from disk');
      }
      assert.equal(reloadedCat.name, 'Coffee');

      const reloadedSummary = store2.getMonthSummary(mustYearMonth('2026-11'));
      assert.equal(reloadedSummary.expenses, 45_000);
      assert.equal(reloadedSummary.transactions[0]?.id, savedTxId);
    } finally {
      db2.close();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('transaction CRUD, undo restore, memoized snapshots, and carry-over switching', () => {
  const rawDb = new DatabaseSync(':memory:');
  try {
    const db = createSqliteExecutor(rawDb);
    initDatabase(db, { seedDevData: false });
    const store = createBudgetStore(db);

    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });

    const nov = mustYearMonth('2026-11');
    const oct = mustYearMonth('2026-10');
    const summaryBefore1 = store.getMonthSummary(nov);
    const summaryBefore2 = store.getMonthSummary(nov);
    assert.strictEqual(summaryBefore1, summaryBefore2);

    const octSalary = parseTransactionDraft(
      {
        type: 'income',
        amountText: '10000000',
        categoryId: mustCatId('cat_income_salary'),
        date: '2026-10-01',
        note: 'October salary',
        currency: 'IDR',
      },
      store.getCategories(),
    );
    assert.equal(octSalary.ok, true);
    if (!octSalary.ok) {
      return;
    }
    store.saveTransaction(octSalary.value);

    const octRent = parseTransactionDraft(
      {
        type: 'expense',
        amountText: '3000000',
        categoryId: mustCatId('cat_expense_bills'),
        date: '2026-10-02',
        note: 'October rent',
        currency: 'IDR',
      },
      store.getCategories(),
    );
    assert.equal(octRent.ok, true);
    if (!octRent.ok) {
      return;
    }
    store.saveTransaction(octRent.value);

    const novFood = parseTransactionDraft(
      {
        type: 'expense',
        amountText: '250000',
        categoryId: mustCatId('cat_expense_food'),
        date: '2026-11-10',
        note: 'Lunch',
        currency: 'IDR',
      },
      store.getCategories(),
    );
    assert.equal(novFood.ok, true);
    if (!novFood.ok) {
      return;
    }
    const createdNovFood = store.saveTransaction(novFood.value);
    assert.equal(notifications, 3);

    const editedDraft = parseTransactionDraft(
      {
        id: createdNovFood.id,
        type: 'expense',
        amountText: '350000',
        categoryId: mustCatId('cat_expense_food'),
        date: '2026-11-10',
        note: 'Lunch & dessert',
        currency: 'IDR',
      },
      store.getCategories(),
    );
    assert.equal(editedDraft.ok, true);
    if (!editedDraft.ok) {
      return;
    }
    const updatedNovFood = store.saveTransaction(editedDraft.value);
    assert.equal(updatedNovFood.amount, 350_000);
    assert.equal(updatedNovFood.createdAt, createdNovFood.createdAt);

    assert.equal(store.getMonthSummary(oct).balance, 7_000_000);
    assert.equal(store.getMonthSummary(nov).carryOverFromPrevious, 0);
    assert.equal(store.getMonthSummary(nov).effectiveBalance, -350_000);

    store.updateSettings({ carryOverEnabled: true });
    assert.equal(store.getMonthSummary(nov).carryOverFromPrevious, 7_000_000);
    assert.equal(store.getMonthSummary(nov).effectiveBalance, 6_650_000);

    const deleted = store.deleteTransaction(updatedNovFood.id);
    if (deleted === null) {
      assert.fail('Expected deleted transaction snapshot');
    }
    assert.equal(store.getTransaction(updatedNovFood.id), null);
    assert.equal(store.getMonthSummary(nov).expenses, 0);

    const restored = store.restoreTransaction(deleted);
    assert.equal(restored.id, updatedNovFood.id);
    assert.equal(store.getMonthSummary(nov).expenses, 350_000);

    unsubscribe();
  } finally {
    rawDb.close();
  }
});

test('SQLite composite foreign key and check constraints reject invalid category/budget writes', () => {
  const rawDb = new DatabaseSync(':memory:');
  try {
    const db = createSqliteExecutor(rawDb);
    initDatabase(db, { seedDevData: false });

    assert.throws(() => {
      db.runSync(
        `
        INSERT INTO transactions (id, type, amount, category_id, date, note, created_at)
        VALUES ('bad_tx', 'expense', 1000, 'cat_income_salary', '2026-11-22', '', '2026-11-22T00:00:00.000Z')
        `,
        [],
      );
    });

    assert.throws(() => {
      db.runSync(
        `
        INSERT INTO categories (id, name, type, icon, color, is_default, monthly_budget, sort_order)
        VALUES ('bad_cat', 'InvalidBudget', 'income', 'wallet-outline', '#059669', 0, 100000, 99)
        `,
        [],
      );
    });
  } finally {
    rawDb.close();
  }
});

test('default categories are protected and deleting custom category atomically reassigns transactions and rules', () => {
  const rawDb = new DatabaseSync(':memory:');
  try {
    const db = createSqliteExecutor(rawDb);
    initDatabase(db, { seedDevData: false });
    const store = createBudgetStore(db);

    assert.throws(() => {
      store.deleteCategory(mustCatId('cat_expense_food'));
    }, /Default categories cannot be deleted/);

    const customDraft = parseCategoryDraft(
      {
        type: 'expense',
        name: 'Subscriptions',
        icon: 'pricetag-outline',
        color: '#2563EB',
        monthlyBudgetText: '',
        currency: 'IDR',
      },
      store.getCategories(),
    );
    assert.equal(customDraft.ok, true);
    if (!customDraft.ok) {
      return;
    }
    const customCat = store.saveCategory(customDraft.value);

    const txDraft = parseTransactionDraft(
      {
        type: 'expense',
        amountText: '120000',
        categoryId: customCat.id,
        date: '2026-11-05',
        note: 'Music sub',
        currency: 'IDR',
      },
      store.getCategories(),
    );
    assert.equal(txDraft.ok, true);
    if (!txDraft.ok) {
      return;
    }
    const tx = store.saveTransaction(txDraft.value);

    const rule = store.saveRecurringRule({
      type: 'expense',
      amount: mustPos(120_000),
      categoryId: customCat.id,
      dayOfMonth: 5,
      note: 'Monthly sub',
      startMonth: mustYearMonth('2026-11'),
      isActive: true,
    });

    const deleted = store.deleteCategory(customCat.id);
    assert.deepEqual(deleted, { reassignedTransactions: 1, reassignedRules: 1 });

    const reloadedTx = store.getTransaction(tx.id);
    assert.equal(reloadedTx?.categoryId, FALLBACK_CATEGORY_ID.expense);
    const reloadedRule = store.getRecurringRules().find((r) => r.id === rule.id);
    assert.equal(reloadedRule?.categoryId, FALLBACK_CATEGORY_ID.expense);

    const deletedTx = store.deleteTransaction(tx.id);
    if (deletedTx === null || deletedTx.type !== 'expense') {
      assert.fail('Expected deleted expense transaction');
    }
    store.deleteTransaction(tx.id);
    const restoredWithMissingCat = store.restoreTransaction({
      ...deletedTx,
      categoryId: customCat.id,
    });
    assert.equal(restoredWithMissingCat.categoryId, FALLBACK_CATEGORY_ID.expense);
  } finally {
    rawDb.close();
  }
});

test('recurring rules materialize idempotently with month-end clamping and preserve edits', () => {
  const rawDb = new DatabaseSync(':memory:');
  try {
    const db = createSqliteExecutor(rawDb);
    initDatabase(db, { seedDevData: false });
    const store = createBudgetStore(db);

    const rule = store.saveRecurringRule({
      type: 'expense',
      amount: mustPos(3_500_000),
      categoryId: mustCatId('cat_expense_bills'),
      dayOfMonth: 31,
      note: 'Monthly rent',
      startMonth: mustYearMonth('2024-01'),
      isActive: true,
    });

    const revBeforeMaterialize = store.getRevision();
    const insertedCount = store.materializeRecurringThrough(mustYearMonth('2024-04'));
    assert.equal(insertedCount, 4);
    assert.equal(store.getRevision(), revBeforeMaterialize + 1);

    const revAfterFirst = store.getRevision();
    const secondCount = store.materializeRecurringThrough(mustYearMonth('2024-04'));
    assert.equal(secondCount, 0);
    assert.equal(store.getRevision(), revAfterFirst);

    const allTxs = store.getAllTransactions();
    const dates = allTxs.map((t) => t.date).sort();
    assert.deepEqual(dates, ['2024-01-31', '2024-02-29', '2024-03-31', '2024-04-30']);

    const febTx = allTxs.find((t) => t.recurringMonth === '2024-02');
    if (!febTx) {
      assert.fail('Expected February recurring transaction');
    }
    const editedFeb = store.saveTransaction({
      id: febTx.id,
      type: 'expense',
      amount: mustPos(3_600_000),
      categoryId: febTx.categoryId,
      date: febTx.date,
      note: 'Rent + repair',
      receiptUri: febTx.receiptUri,
    });
    assert.equal(editedFeb.amount, 3_600_000);

    const reMaterialized = store.materializeRecurringThrough(mustYearMonth('2024-04'));
    assert.equal(reMaterialized, 0);
    assert.equal(store.getTransaction(febTx.id)?.amount, 3_600_000);

    store.deleteRecurringRule(rule.id);
    assert.equal(store.getRecurringRules().length, 0);
    assert.equal(store.getAllTransactions().length, 4);
    assert.equal(store.getTransaction(febTx.id)?.recurringRuleId, null);
  } finally {
    rawDb.close();
  }
});

test('dev seed is idempotent across restarts and resetDevSeed restores baseline sample data', () => {
  const rawDb = new DatabaseSync(':memory:');
  try {
    const db = createSqliteExecutor(rawDb);
    const refDate = mustIsoDate('2026-11-22');
    initDatabase(db, { seedDevData: true, referenceDate: refDate });
    const store = createBudgetStore(db);

    const initialCount = store.getAllTransactions().length;
    assert.ok(initialCount > 10);
    assert.equal(store.getSettings().devSeeded, true);

    const novSummary = store.getMonthSummary(mustYearMonth('2026-11'));
    const octSummary = store.getMonthSummary(mustYearMonth('2026-10'));
    assert.ok(novSummary.income > 0);
    assert.ok(novSummary.expenses > 0);
    assert.ok(octSummary.income > 0);
    assert.ok(octSummary.expenses > 0);

    initDatabase(db, { seedDevData: true, referenceDate: refDate });
    seedDevSampleData(db, refDate);
    assert.equal(store.getAllTransactions().length, initialCount);

    const customCat = parseCategoryDraft(
      {
        type: 'expense',
        name: 'Travel',
        icon: 'airplane-outline',
        color: '#0284C7',
        monthlyBudgetText: '',
        currency: 'IDR',
      },
      store.getCategories(),
    );
    assert.equal(customCat.ok, true);
    if (!customCat.ok) {
      return;
    }
    store.saveCategory(customCat.value);
    store.updateSettings({ currency: 'EUR', carryOverEnabled: true });

    store.resetDevSeed(refDate);
    assert.equal(store.getCategories().length, DEFAULT_CATEGORIES.length);
    assert.equal(store.getSettings().currency, 'IDR');
    assert.equal(store.getSettings().carryOverEnabled, false);
    assert.equal(store.getAllTransactions().length, initialCount);
  } finally {
    rawDb.close();
  }
});

test('SQLite v1 database migrates idempotently to v3 and persists receiptUri across reopen, edit, clear, and undo', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pocket-ledger-v2-migration-'));
  const dbPath = path.join(tempDir, 'ledger-v1.db');

  try {
    const db1 = new DatabaseSync(dbPath);
    try {
      const exec1 = createSqliteExecutor(db1);
      exec1.execSync('PRAGMA foreign_keys = ON;');
      exec1.execSync(SCHEMA_V1_DDL);
      insertDefaultCategories(exec1);
      insertDefaultSettings(exec1);

      exec1.runSync(
        `
        INSERT INTO transactions (
          id, type, amount, category_id, date, note, created_at, recurring_rule_id, recurring_month
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
        `,
        [
          'v1_income_1',
          'income',
          8_500_000,
          'cat_income_salary',
          '2026-10-01',
          'Legacy v1 salary',
          '2026-10-01T08:00:00.000Z',
        ],
      );
      exec1.runSync(
        `
        INSERT INTO transactions (
          id, type, amount, category_id, date, note, created_at, recurring_rule_id, recurring_month
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
        `,
        [
          'v1_expense_1',
          'expense',
          125_000,
          'cat_expense_food',
          '2026-10-12',
          'Legacy v1 lunch',
          '2026-10-12T12:30:00.000Z',
        ],
      );
      exec1.execSync('PRAGMA user_version = 1;');

      const v1Columns = exec1
        .getAllSync<unknown>('PRAGMA table_info(transactions)', [])
        .map(parseTableInfoColumnName);
      assert.equal(v1Columns.includes('receipt_uri'), false);
      const v1Version = exec1.getFirstSync<{ user_version: number }>('PRAGMA user_version', []);
      assert.equal(v1Version?.user_version, 1);
    } finally {
      db1.close();
    }

    let receiptTxId: TransactionId | null = null;
    const firstReceiptUri = 'file:///documents/receipts/receipt_100.jpg';
    const secondReceiptUri = 'file:///documents/receipts/receipt_200.png';

    const db2 = new DatabaseSync(dbPath);
    try {
      const exec2 = createSqliteExecutor(db2);
      initDatabase(exec2, { seedDevData: false });
      initDatabase(exec2, { seedDevData: false });
      applyMigrationV2(exec2);
      applyMigrationV3(exec2);

      const v3Version = exec2.getFirstSync<{ user_version: number }>('PRAGMA user_version', []);
      assert.equal(v3Version?.user_version, 3);

      const v3Columns = exec2
        .getAllSync<unknown>('PRAGMA table_info(transactions)', [])
        .map(parseTableInfoColumnName);
      assert.equal(v3Columns.includes('receipt_uri'), true);

      const skipTableRow = exec2.getFirstSync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'recurring_skips'",
        [],
      );
      assert.equal(skipTableRow?.name, 'recurring_skips');

      const store2 = createBudgetStore(exec2);
      const migratedTxs = store2.getAllTransactions();
      assert.equal(migratedTxs.length, 2);

      const legacyIncome = migratedTxs.find((t) => t.id === 'v1_income_1');
      const legacyExpense = migratedTxs.find((t) => t.id === 'v1_expense_1');
      assert.ok(legacyIncome);
      assert.ok(legacyExpense);
      assert.equal(legacyIncome.amount, 8_500_000);
      assert.equal(legacyIncome.note, 'Legacy v1 salary');
      assert.equal(legacyIncome.receiptUri, null);
      assert.equal(legacyExpense.amount, 125_000);
      assert.equal(legacyExpense.note, 'Legacy v1 lunch');
      assert.equal(legacyExpense.receiptUri, null);

      const draft = parseTransactionDraft(
        {
          type: 'expense',
          amountText: '275000',
          categoryId: mustCatId('cat_expense_food'),
          date: '2026-11-18',
          note: 'Groceries with receipt',
          currency: 'IDR',
          receiptUri: `  ${firstReceiptUri}  `,
        },
        store2.getCategories(),
      );
      assert.equal(draft.ok, true);
      if (!draft.ok) {
        return;
      }
      const saved = store2.saveTransaction(draft.value);
      assert.equal(saved.receiptUri, firstReceiptUri);
      receiptTxId = saved.id;
    } finally {
      db2.close();
    }

    if (receiptTxId === null) {
      assert.fail('Expected receiptTxId to be assigned');
    }

    const db3 = new DatabaseSync(dbPath);
    try {
      const exec3 = createSqliteExecutor(db3);
      initDatabase(exec3, { seedDevData: false });
      const store3 = createBudgetStore(exec3);

      const txAfterReopen = store3.getTransaction(receiptTxId);
      if (!txAfterReopen) {
        assert.fail('Expected reopened transaction');
      }
      assert.equal(txAfterReopen.receiptUri, firstReceiptUri);

      const editDraft = parseTransactionDraft(
        {
          id: txAfterReopen.id,
          type: 'expense',
          amountText: '280000',
          categoryId: mustCatId('cat_expense_food'),
          date: '2026-11-18',
          note: 'Groceries updated receipt',
          currency: 'IDR',
          receiptUri: secondReceiptUri,
        },
        store3.getCategories(),
      );
      assert.equal(editDraft.ok, true);
      if (!editDraft.ok) {
        return;
      }
      const updated = store3.saveTransaction(editDraft.value);
      assert.equal(updated.receiptUri, secondReceiptUri);

      const deleted = store3.deleteTransaction(updated.id);
      assert.equal(deleted?.receiptUri, secondReceiptUri);
      assert.equal(store3.getTransaction(updated.id), null);

      if (!deleted) {
        assert.fail('Expected deleted transaction snapshot');
      }
      const restored = store3.restoreTransaction(deleted);
      assert.equal(restored.receiptUri, secondReceiptUri);
    } finally {
      db3.close();
    }

    const db4 = new DatabaseSync(dbPath);
    try {
      const exec4 = createSqliteExecutor(db4);
      const store4 = createBudgetStore(exec4);
      const reloaded = store4.getTransaction(receiptTxId);
      assert.ok(reloaded);
      assert.equal(reloaded.receiptUri, secondReceiptUri);
      assert.equal(reloaded.amount, 280_000);

      const clearDraft = parseTransactionDraft(
        {
          id: reloaded.id,
          type: 'expense',
          amountText: '280000',
          categoryId: reloaded.categoryId,
          date: reloaded.date,
          note: reloaded.note,
          currency: 'IDR',
          receiptUri: null,
        },
        store4.getCategories(),
      );
      assert.equal(clearDraft.ok, true);
      if (!clearDraft.ok) {
        return;
      }
      const cleared = store4.saveTransaction(clearDraft.value);
      assert.equal(cleared.receiptUri, null);
    } finally {
      db4.close();
    }

    const db5 = new DatabaseSync(dbPath);
    try {
      const exec5 = createSqliteExecutor(db5);
      const store5 = createBudgetStore(exec5);
      const reloadedAfterClear = store5.getTransaction(receiptTxId);
      assert.ok(reloadedAfterClear);
      assert.equal(reloadedAfterClear.receiptUri, null);
    } finally {
      db5.close();
    }

    assert.throws(() => {
      parseTransactionRow({
        id: 'tx_bad_receipt',
        type: 'expense',
        amount: 1000,
        category_id: 'cat_expense_food',
        date: '2026-11-18',
        note: 'Bad',
        created_at: '2026-11-18T10:00:00.000Z',
        recurring_rule_id: null,
        recurring_month: null,
        receipt_uri: 999,
      });
    }, /receipt_uri/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('deleted recurring transactions stay skipped across rematerialization until restored, and skips clear on rule delete or dev reset', () => {
  const rawDb = new DatabaseSync(':memory:');
  try {
    const db = createSqliteExecutor(rawDb);
    initDatabase(db, { seedDevData: false });
    const store = createBudgetStore(db);

    const rule = store.saveRecurringRule({
      type: 'expense',
      amount: mustPos(500_000),
      categoryId: mustCatId('cat_expense_bills'),
      dayOfMonth: 15,
      note: 'Internet bill',
      startMonth: mustYearMonth('2026-01'),
      isActive: true,
    });

    assert.equal(store.materializeRecurringThrough(mustYearMonth('2026-03')), 3);
    const febTx = store.getAllTransactions().find((t) => t.recurringMonth === '2026-02');
    if (!febTx) {
      assert.fail('Expected February recurring transaction');
    }

    const deletedFeb = store.deleteTransaction(febTx.id);
    if (!deletedFeb) {
      assert.fail('Expected deleted February transaction');
    }

    const skipCountAfterDelete = db.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM recurring_skips WHERE recurring_rule_id = ? AND recurring_month = ?',
      [rule.id, '2026-02'],
    );
    assert.equal(skipCountAfterDelete?.count, 1);

    assert.equal(store.materializeRecurringThrough(mustYearMonth('2026-04')), 1);
    const monthsAfterSkip = store
      .getAllTransactions()
      .map((t) => t.recurringMonth)
      .sort();
    assert.deepEqual(monthsAfterSkip, ['2026-01', '2026-03', '2026-04']);

    store.restoreTransaction(deletedFeb);
    const skipCountAfterRestore = db.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM recurring_skips WHERE recurring_rule_id = ? AND recurring_month = ?',
      [rule.id, '2026-02'],
    );
    assert.equal(skipCountAfterRestore?.count, 0);
    assert.equal(store.materializeRecurringThrough(mustYearMonth('2026-04')), 0);
    assert.equal(store.getAllTransactions().length, 4);

    store.deleteTransaction(febTx.id);
    assert.equal(store.materializeRecurringThrough(mustYearMonth('2026-05')), 1);
    assert.equal(
      store.getAllTransactions().some((t) => t.recurringMonth === '2026-02'),
      false,
    );

    store.deleteRecurringRule(rule.id);
    const skipCountAfterRuleDelete = db.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM recurring_skips',
      [],
    );
    assert.equal(skipCountAfterRuleDelete?.count, 0);

    const rule2 = store.saveRecurringRule({
      type: 'expense',
      amount: mustPos(250_000),
      categoryId: mustCatId('cat_expense_food'),
      dayOfMonth: 10,
      note: 'Meal plan',
      startMonth: mustYearMonth('2026-01'),
      isActive: true,
    });
    assert.equal(store.materializeRecurringThrough(mustYearMonth('2026-01')), 1);
    const janTx2 = store
      .getAllTransactions()
      .find((t) => t.recurringRuleId === rule2.id && t.recurringMonth === '2026-01');
    if (!janTx2) {
      assert.fail('Expected January transaction for rule2');
    }
    store.deleteTransaction(janTx2.id);

    store.resetDevSeed(mustIsoDate('2026-11-22'));
    const skipCountAfterReset = db.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM recurring_skips',
      [],
    );
    assert.equal(skipCountAfterReset?.count, 0);
  } finally {
    rawDb.close();
  }
});

test('updateSettings preserves cached transactions, categories, rules, and month summaries unless carryOverEnabled changes', () => {
  const rawDb = new DatabaseSync(':memory:');
  try {
    const db = createSqliteExecutor(rawDb);
    initDatabase(db, { seedDevData: false });
    const store = createBudgetStore(db);

    const octDraft = parseTransactionDraft(
      {
        type: 'income',
        amountText: '5000000',
        categoryId: mustCatId('cat_income_salary'),
        date: '2026-10-01',
        note: 'Oct income',
        currency: 'IDR',
      },
      store.getCategories(),
    );
    assert.equal(octDraft.ok, true);
    if (!octDraft.ok) {
      return;
    }
    store.saveTransaction(octDraft.value);

    const novDraft = parseTransactionDraft(
      {
        type: 'expense',
        amountText: '1000000',
        categoryId: mustCatId('cat_expense_food'),
        date: '2026-11-10',
        note: 'Nov groceries',
        currency: 'IDR',
      },
      store.getCategories(),
    );
    assert.equal(novDraft.ok, true);
    if (!novDraft.ok) {
      return;
    }
    store.saveTransaction(novDraft.value);

    store.saveRecurringRule({
      type: 'expense',
      amount: mustPos(300_000),
      categoryId: mustCatId('cat_expense_bills'),
      dayOfMonth: 5,
      note: 'Phone plan',
      startMonth: mustYearMonth('2026-11'),
      isActive: true,
    });

    const nov = mustYearMonth('2026-11');
    const txsBefore = store.getAllTransactions();
    const catsBefore = store.getCategories();
    const rulesBefore = store.getRecurringRules();
    const summaryBefore = store.getMonthSummary(nov);

    store.updateSettings({ theme: 'dark' });
    assert.equal(store.getSettings().theme, 'dark');
    assert.strictEqual(store.getAllTransactions(), txsBefore);
    assert.strictEqual(store.getCategories(), catsBefore);
    assert.strictEqual(store.getRecurringRules(), rulesBefore);
    assert.strictEqual(store.getMonthSummary(nov), summaryBefore);

    store.updateSettings({ currency: 'USD' });
    assert.equal(store.getSettings().currency, 'USD');
    assert.strictEqual(store.getAllTransactions(), txsBefore);
    assert.strictEqual(store.getMonthSummary(nov), summaryBefore);

    store.updateSettings({ carryOverEnabled: true });
    assert.equal(store.getSettings().carryOverEnabled, true);
    assert.strictEqual(store.getAllTransactions(), txsBefore);
    assert.strictEqual(store.getCategories(), catsBefore);
    assert.strictEqual(store.getRecurringRules(), rulesBefore);
    const summaryAfterCarryOver = store.getMonthSummary(nov);
    assert.notStrictEqual(summaryAfterCarryOver, summaryBefore);
    assert.equal(summaryAfterCarryOver.carryOverFromPrevious, 5_000_000);
    assert.equal(summaryAfterCarryOver.effectiveBalance, 4_000_000);
  } finally {
    rawDb.close();
  }
});

test('getTransactionCount tracks empty DB, inserts, deletes, restores, materialization, and preserves cache across settings/category saves', () => {
  const rawDb = new DatabaseSync(':memory:');
  try {
    const baseExec = createSqliteExecutor(rawDb);
    let countQueryCalls = 0;
    const countingExec: SqlExecutor = {
      execSync(source) {
        baseExec.execSync(source);
      },
      runSync(source, params) {
        return baseExec.runSync(source, params);
      },
      getFirstSync<T>(source: string, params: SqlParam[]): T | null {
        if (source.includes('COUNT(*) AS count FROM transactions')) {
          countQueryCalls += 1;
        }
        return baseExec.getFirstSync<T>(source, params);
      },
      getAllSync<T>(source: string, params: SqlParam[]): T[] {
        return baseExec.getAllSync<T>(source, params);
      },
      withTransactionSync(task) {
        baseExec.withTransactionSync(task);
      },
    };

    initDatabase(countingExec, { seedDevData: false });
    const store = createBudgetStore(countingExec);

    assert.equal(store.getTransactionCount(), 0);
    assert.equal(store.getTransactionCount(), 0);
    assert.equal(countQueryCalls, 1);

    const salaryDraft = parseTransactionDraft(
      {
        type: 'income',
        amountText: '4000000',
        categoryId: mustCatId('cat_income_salary'),
        date: '2026-11-01',
        note: 'Salary',
        currency: 'IDR',
      },
      store.getCategories(),
    );
    assert.equal(salaryDraft.ok, true);
    if (!salaryDraft.ok) {
      return;
    }
    const savedSalary = store.saveTransaction(salaryDraft.value);
    assert.equal(store.getTransactionCount(), 1);

    const foodDraft = parseTransactionDraft(
      {
        type: 'expense',
        amountText: '85000',
        categoryId: mustCatId('cat_expense_food'),
        date: '2026-11-02',
        note: 'Lunch',
        currency: 'IDR',
      },
      store.getCategories(),
    );
    assert.equal(foodDraft.ok, true);
    if (!foodDraft.ok) {
      return;
    }
    const savedFood = store.saveTransaction(foodDraft.value);
    assert.equal(store.getTransactionCount(), 2);
    assert.equal(countQueryCalls, 3);

    const customCatDraft = parseCategoryDraft(
      {
        type: 'expense',
        name: 'Books',
        icon: 'book-outline',
        color: '#2563EB',
        monthlyBudgetText: '',
        currency: 'IDR',
      },
      store.getCategories(),
    );
    assert.equal(customCatDraft.ok, true);
    if (!customCatDraft.ok) {
      return;
    }
    store.saveCategory(customCatDraft.value);
    store.updateSettings({ theme: 'dark' });
    assert.equal(store.getTransactionCount(), 2);
    assert.equal(countQueryCalls, 3);

    const deleted = store.deleteTransaction(savedFood.id);
    assert.ok(deleted);
    assert.equal(store.getTransactionCount(), 1);
    assert.equal(countQueryCalls, 4);

    const restored = store.restoreTransaction(deleted);
    assert.equal(restored.id, savedFood.id);
    assert.equal(store.getTransactionCount(), 2);
    assert.equal(countQueryCalls, 5);

    store.saveRecurringRule({
      type: 'expense',
      amount: mustPos(150_000),
      categoryId: mustCatId('cat_expense_bills'),
      dayOfMonth: 10,
      note: 'Water bill',
      startMonth: mustYearMonth('2026-10'),
      isActive: true,
    });
    const materialized = store.materializeRecurringThrough(mustYearMonth('2026-11'));
    assert.equal(materialized, 2);
    assert.equal(store.getAllTransactions().length, 4);
    assert.equal(store.getTransactionCount(), 4);
    assert.equal(countQueryCalls, 5);

    store.resetDevSeed(mustIsoDate('2026-11-22'));
    const seededCount = store.getTransactionCount();
    assert.ok(seededCount > 10);
    assert.equal(seededCount, store.getAllTransactions().length);
    assert.equal(savedSalary.id !== '', true);
  } finally {
    rawDb.close();
  }
});
