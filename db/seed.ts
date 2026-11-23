import type { IsoDate, TransactionType, YearMonth } from '../types/domain';
import { clampDayToMonth, isoDateToYearMonth, stepYearMonth, todayIsoDate } from '../utils/date';
import { parseCountRow, parseSettingsRow } from './parsers';
import {
  insertDefaultCategories,
  insertDefaultSettings,
  type SqlExecutor,
} from './schema';

interface SampleSeedEntry {
  readonly idSuffix: string;
  readonly monthOffset: 0 | -1;
  readonly day: number;
  readonly type: TransactionType;
  readonly categoryId: string;
  readonly amount: number;
  readonly note: string;
}

const SAMPLE_ENTRIES: readonly SampleSeedEntry[] = [
  {
    idSuffix: 'prev_salary',
    monthOffset: -1,
    day: 1,
    type: 'income',
    categoryId: 'cat_income_salary',
    amount: 12_500_000,
    note: 'Monthly salary',
  },
  {
    idSuffix: 'prev_rent',
    monthOffset: -1,
    day: 2,
    type: 'expense',
    categoryId: 'cat_expense_bills',
    amount: 3_500_000,
    note: 'Apartment rent & internet',
  },
  {
    idSuffix: 'prev_food_1',
    monthOffset: -1,
    day: 4,
    type: 'expense',
    categoryId: 'cat_expense_food',
    amount: 410_000,
    note: 'Weekly groceries',
  },
  {
    idSuffix: 'prev_transport_1',
    monthOffset: -1,
    day: 6,
    type: 'expense',
    categoryId: 'cat_expense_transport',
    amount: 260_000,
    note: 'Commuter pass & fuel',
  },
  {
    idSuffix: 'prev_health',
    monthOffset: -1,
    day: 9,
    type: 'expense',
    categoryId: 'cat_expense_health',
    amount: 240_000,
    note: 'Dental checkup',
  },
  {
    idSuffix: 'prev_food_2',
    monthOffset: -1,
    day: 11,
    type: 'expense',
    categoryId: 'cat_expense_food',
    amount: 320_000,
    note: 'Lunch & coffee',
  },
  {
    idSuffix: 'prev_shopping',
    monthOffset: -1,
    day: 13,
    type: 'expense',
    categoryId: 'cat_expense_shopping',
    amount: 1_150_000,
    note: 'Running shoes',
  },
  {
    idSuffix: 'prev_business',
    monthOffset: -1,
    day: 14,
    type: 'income',
    categoryId: 'cat_income_business',
    amount: 1_800_000,
    note: 'UI consulting retainer',
  },
  {
    idSuffix: 'prev_bills_2',
    monthOffset: -1,
    day: 18,
    type: 'expense',
    categoryId: 'cat_expense_bills',
    amount: 580_000,
    note: 'Electricity & water',
  },
  {
    idSuffix: 'prev_transport_2',
    monthOffset: -1,
    day: 19,
    type: 'expense',
    categoryId: 'cat_expense_transport',
    amount: 175_000,
    note: 'Ride-hailing trips',
  },
  {
    idSuffix: 'prev_gift',
    monthOffset: -1,
    day: 20,
    type: 'income',
    categoryId: 'cat_income_gift',
    amount: 500_000,
    note: 'Family gift',
  },
  {
    idSuffix: 'prev_food_3',
    monthOffset: -1,
    day: 21,
    type: 'expense',
    categoryId: 'cat_expense_food',
    amount: 290_000,
    note: 'Weekend dinner',
  },
  {
    idSuffix: 'prev_entertainment',
    monthOffset: -1,
    day: 22,
    type: 'expense',
    categoryId: 'cat_expense_entertainment',
    amount: 310_000,
    note: 'Cinema & streaming',
  },
  {
    idSuffix: 'curr_salary',
    monthOffset: 0,
    day: 1,
    type: 'income',
    categoryId: 'cat_income_salary',
    amount: 12_500_000,
    note: 'Monthly salary',
  },
  {
    idSuffix: 'curr_rent',
    monthOffset: 0,
    day: 2,
    type: 'expense',
    categoryId: 'cat_expense_bills',
    amount: 3_500_000,
    note: 'Apartment rent & internet',
  },
  {
    idSuffix: 'curr_food_1',
    monthOffset: 0,
    day: 3,
    type: 'expense',
    categoryId: 'cat_expense_food',
    amount: 430_000,
    note: 'Fresh market groceries',
  },
  {
    idSuffix: 'curr_transport_1',
    monthOffset: 0,
    day: 5,
    type: 'expense',
    categoryId: 'cat_expense_transport',
    amount: 220_000,
    note: 'Fuel & highway toll',
  },
  {
    idSuffix: 'curr_food_2',
    monthOffset: 0,
    day: 7,
    type: 'expense',
    categoryId: 'cat_expense_food',
    amount: 275_000,
    note: 'Team lunch & coffee',
  },
  {
    idSuffix: 'curr_business',
    monthOffset: 0,
    day: 8,
    type: 'income',
    categoryId: 'cat_income_business',
    amount: 3_200_000,
    note: 'Mobile prototype freelance',
  },
  {
    idSuffix: 'curr_health',
    monthOffset: 0,
    day: 9,
    type: 'expense',
    categoryId: 'cat_expense_health',
    amount: 315_000,
    note: 'Vitamins & clinic',
  },
  {
    idSuffix: 'curr_shopping',
    monthOffset: 0,
    day: 10,
    type: 'expense',
    categoryId: 'cat_expense_shopping',
    amount: 640_000,
    note: 'Desk accessories',
  },
  {
    idSuffix: 'curr_food_3',
    monthOffset: 0,
    day: 12,
    type: 'expense',
    categoryId: 'cat_expense_food',
    amount: 185_000,
    note: 'Dinner takeout',
  },
  {
    idSuffix: 'curr_transport_2',
    monthOffset: 0,
    day: 14,
    type: 'expense',
    categoryId: 'cat_expense_transport',
    amount: 145_000,
    note: 'Train & ride-hailing',
  },
  {
    idSuffix: 'curr_bills_2',
    monthOffset: 0,
    day: 15,
    type: 'expense',
    categoryId: 'cat_expense_bills',
    amount: 540_000,
    note: 'Electricity & mobile plan',
  },
  {
    idSuffix: 'curr_entertainment',
    monthOffset: 0,
    day: 16,
    type: 'expense',
    categoryId: 'cat_expense_entertainment',
    amount: 195_000,
    note: 'Movie night & music',
  },
];

function insertSampleSeedRows(db: SqlExecutor, referenceDate: IsoDate): void {
  const currentMonth: YearMonth = isoDateToYearMonth(referenceDate);
  const previousMonth: YearMonth = stepYearMonth(currentMonth, -1);

  db.runSync('UPDATE categories SET monthly_budget = ? WHERE id = ?', [
    1_000_000,
    'cat_expense_food',
  ]);
  db.runSync('UPDATE categories SET monthly_budget = ? WHERE id = ?', [
    4_500_000,
    'cat_expense_bills',
  ]);

  const insertSql = `
    INSERT OR IGNORE INTO transactions (
      id, type, amount, category_id, date, note, created_at, recurring_rule_id, recurring_month, receipt_uri
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
  `;

  SAMPLE_ENTRIES.forEach((entry, index) => {
    const targetMonth = entry.monthOffset === 0 ? currentMonth : previousMonth;
    const date = clampDayToMonth(targetMonth, entry.day);
    const second = String(index).padStart(2, '0');
    const createdAt = `${date}T09:00:${second}.000Z`;
    db.runSync(insertSql, [
      `seed_${entry.idSuffix}`,
      entry.type,
      entry.amount,
      entry.categoryId,
      date,
      entry.note,
      createdAt,
    ]);
  });

  db.runSync('UPDATE settings SET dev_seeded = 1 WHERE id = 1', []);
}

function shouldSeed(db: SqlExecutor): boolean {
  const settingsRow = db.getFirstSync<unknown>(
    'SELECT currency, carry_over_enabled, theme, dev_seeded FROM settings WHERE id = 1',
    [],
  );
  if (settingsRow === null) {
    return false;
  }
  const settings = parseSettingsRow(settingsRow);
  if (settings.devSeeded) {
    return false;
  }
  const countRow = db.getFirstSync<unknown>('SELECT COUNT(*) AS count FROM transactions', []);
  const txCount = countRow === null ? 0 : parseCountRow(countRow);
  return txCount === 0;
}

export function seedDevSampleData(
  db: SqlExecutor,
  referenceDate: IsoDate = todayIsoDate(),
): void {
  if (!shouldSeed(db)) {
    return;
  }

  db.withTransactionSync(() => {
    if (!shouldSeed(db)) {
      return;
    }
    insertSampleSeedRows(db, referenceDate);
  });
}

export function resetDevSeed(
  db: SqlExecutor,
  referenceDate: IsoDate = todayIsoDate(),
): void {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM transactions', []);
    db.runSync('DELETE FROM recurring_skips', []);
    db.runSync('DELETE FROM recurring_rules', []);
    db.runSync('DELETE FROM categories', []);
    insertDefaultCategories(db);
    insertDefaultSettings(db);
    db.runSync(
      "UPDATE settings SET currency = 'IDR', carry_over_enabled = 0, theme = 'system', dev_seeded = 0 WHERE id = 1",
      [],
    );
    insertSampleSeedRows(db, referenceDate);
  });
}
