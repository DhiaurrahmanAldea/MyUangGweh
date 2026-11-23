/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_MONEY_MINOR_UNITS,
  MAX_RECEIPT_URI_LENGTH,
  ZERO_MINOR_UNITS,
  extractSafeReceiptExtension,
  isManagedReceiptUri,
  parseCategoryDraft,
  parseCategoryId,
  parseHexColor,
  parseIsoDate,
  parseIsoTimestamp,
  parseMinorUnits,
  parsePositiveMinorUnits,
  parseReceiptUri,
  parseTransactionDraft,
  parseTransactionId,
  parseYearMonth,
  type Category,
  type CategoryId,
  type ExpenseCategory,
  type ExpenseTransaction,
  type HexColor,
  type IncomeCategory,
  type IncomeTransaction,
  type IsoDate,
  type IsoTimestamp,
  type MinorUnits,
  type PositiveMinorUnits,
  type Transaction,
  type TransactionId,
  type YearMonth,
} from '../types/domain';
import { serializeTransactionsToCsv } from './csv';
import {
  CALENDAR_WEEKDAY_LABELS,
  buildMonthCalendarGrid,
  clampDayToMonth,
  currentYearMonth,
  daysInYearMonth,
  formatFullDateLabel,
  formatMonthLabel,
  formatSectionDateLabel,
  formatShortMonthLabel,
  isoDateToYearMonth,
  monthDateRange,
  shiftIsoDate,
  stepYearMonth,
  todayIsoDate,
} from './date';
import {
  carryOverBalance,
  categorySpendingBreakdown,
  evaluateBudgetStatus,
  filterTransactions,
  formatEditableAmount,
  formatInputAmount,
  formatMoney,
  groupTransactionsByDate,
  monthOverMonthComparison,
  parseAmountInput,
  remainingBalance,
  spentPercentage,
  summarizeMonth,
  totalExpenses,
  totalIncome,
} from './money';

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

function mustTxId(value: string): TransactionId {
  const parsed = parseTransactionId(value);
  if (parsed === null) {
    throw new Error(`Expected valid TransactionId: ${value}`);
  }
  return parsed;
}

function mustTs(value: string): IsoTimestamp {
  const parsed = parseIsoTimestamp(value);
  if (parsed === null) {
    throw new Error(`Expected valid IsoTimestamp: ${value}`);
  }
  return parsed;
}

function mustHex(value: string): HexColor {
  const parsed = parseHexColor(value);
  if (parsed === null) {
    throw new Error(`Expected valid HexColor: ${value}`);
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

function mustMinor(value: number): MinorUnits {
  const parsed = parseMinorUnits(value);
  if (parsed === null) {
    throw new Error(`Expected valid MinorUnits: ${value}`);
  }
  return parsed;
}

const FOOD_CAT: ExpenseCategory = {
  id: mustCatId('cat_expense_food'),
  name: 'Food',
  type: 'expense',
  icon: 'restaurant-outline',
  color: mustHex('#EA580C'),
  isDefault: true,
  monthlyBudget: mustPos(1_000_000),
  sortOrder: 1,
};

const BILLS_CAT: ExpenseCategory = {
  id: mustCatId('cat_expense_bills'),
  name: 'Bills',
  type: 'expense',
  icon: 'receipt-outline',
  color: mustHex('#7C3AED'),
  isDefault: true,
  monthlyBudget: null,
  sortOrder: 2,
};

const SALARY_CAT: IncomeCategory = {
  id: mustCatId('cat_income_salary'),
  name: 'Salary',
  type: 'income',
  icon: 'wallet-outline',
  color: mustHex('#059669'),
  isDefault: true,
  sortOrder: 1,
};

const TEST_CATEGORIES: readonly Category[] = [FOOD_CAT, BILLS_CAT, SALARY_CAT];

function makeIncome(
  id: string,
  amount: number,
  date: string,
  note = 'Salary',
  createdAt = `${date}T09:00:00.000Z`,
): IncomeTransaction {
  return {
    id: mustTxId(id),
    type: 'income',
    amount: mustPos(amount),
    categoryId: SALARY_CAT.id,
    date: mustIsoDate(date),
    note,
    createdAt: mustTs(createdAt),
    recurringRuleId: null,
    recurringMonth: null,
    receiptUri: null,
  };
}

function makeExpense(
  id: string,
  amount: number,
  date: string,
  categoryId: CategoryId = FOOD_CAT.id,
  note = 'Lunch',
  createdAt = `${date}T12:00:00.000Z`,
): ExpenseTransaction {
  return {
    id: mustTxId(id),
    type: 'expense',
    amount: mustPos(amount),
    categoryId,
    date: mustIsoDate(date),
    note,
    createdAt: mustTs(createdAt),
    recurringRuleId: null,
    recurringMonth: null,
    receiptUri: null,
  };
}

test('domain boundary parsers validate dates, months, hex colors, and drafts', () => {
  assert.equal(parseIsoDate('2024-02-29'), '2024-02-29');
  assert.equal(parseIsoDate('2025-02-29'), null);
  assert.equal(parseIsoDate('2025-04-31'), null);
  assert.equal(parseIsoDate('2025-13-01'), null);
  assert.equal(parseIsoDate('2025-03-15 '), null);

  assert.equal(parseYearMonth('2026-11'), '2026-11');
  assert.equal(parseYearMonth('2026-00'), null);
  assert.equal(parseYearMonth('2026-13'), null);

  assert.equal(parseHexColor('#0f766e'), '#0F766E');
  assert.equal(parseHexColor('#GGGGGG'), null);
  assert.equal(parseHexColor('#FFF'), null);

  const txBad = parseTransactionDraft(
    {
      type: 'expense',
      amountText: '0',
      categoryId: SALARY_CAT.id,
      date: '2025-02-29',
      note: '  test  ',
      currency: 'IDR',
    },
    TEST_CATEGORIES,
  );
  assert.equal(txBad.ok, false);
  if (!txBad.ok) {
    assert.equal(txBad.error.amount, 'zero-or-negative');
    assert.equal(txBad.error.categoryId, 'category-type-mismatch');
    assert.equal(txBad.error.date, 'invalid-date');
  }

  const txGood = parseTransactionDraft(
    {
      type: 'expense',
      amountText: '1.500.000',
      categoryId: FOOD_CAT.id,
      date: '2026-11-22',
      note: '  Groceries  ',
      currency: 'IDR',
    },
    TEST_CATEGORIES,
  );
  assert.equal(txGood.ok, true);
  if (txGood.ok) {
    assert.equal(txGood.value.amount, 1_500_000);
    assert.equal(txGood.value.note, 'Groceries');
  }

  const catDup = parseCategoryDraft(
    {
      type: 'expense',
      name: ' food ',
      icon: 'cafe-outline',
      color: '#123456',
      monthlyBudgetText: '500000',
      currency: 'IDR',
    },
    TEST_CATEGORIES,
  );
  assert.equal(catDup.ok, false);
  if (!catDup.ok) {
    assert.equal(catDup.error.name, 'duplicate');
  }

  const incomeWithBudget = parseCategoryDraft(
    {
      type: 'income',
      name: 'Bonus',
      icon: 'gift-outline',
      color: '#059669',
      monthlyBudgetText: '100000',
      currency: 'IDR',
    },
    TEST_CATEGORIES,
  );
  assert.equal(incomeWithBudget.ok, false);
  if (!incomeWithBudget.ok) {
    assert.equal(incomeWithBudget.error.monthlyBudget, 'income-cannot-have-budget');
  }
});

test('date utilities perform local calendar math without UTC shifts', () => {
  const localMidnight = new Date(2026, 2, 1, 0, 5, 0);
  assert.equal(todayIsoDate(localMidnight), '2026-03-01');
  assert.equal(currentYearMonth(localMidnight), '2026-03');
  assert.equal(isoDateToYearMonth(mustIsoDate('2026-03-19')), '2026-03');

  assert.equal(stepYearMonth(mustYearMonth('2026-01'), -1), '2025-12');
  assert.equal(stepYearMonth(mustYearMonth('2025-12'), 1), '2026-01');
  assert.equal(stepYearMonth(mustYearMonth('2026-03'), -14), '2025-01');

  assert.deepEqual(monthDateRange(mustYearMonth('2026-12')), {
    start: '2026-12-01',
    nextStart: '2027-01-01',
  });

  assert.equal(daysInYearMonth(mustYearMonth('2024-02')), 29);
  assert.equal(daysInYearMonth(mustYearMonth('2025-02')), 28);
  assert.equal(daysInYearMonth(mustYearMonth('2026-04')), 30);
  assert.equal(daysInYearMonth(mustYearMonth('2026-03')), 31);

  assert.equal(clampDayToMonth(mustYearMonth('2024-02'), 31), '2024-02-29');
  assert.equal(clampDayToMonth(mustYearMonth('2025-02'), 31), '2025-02-28');
  assert.equal(clampDayToMonth(mustYearMonth('2026-04'), 31), '2026-04-30');
  assert.equal(clampDayToMonth(mustYearMonth('2026-04'), 0), '2026-04-01');

  assert.equal(shiftIsoDate(mustIsoDate('2026-03-01'), -1), '2026-02-28');
  assert.equal(shiftIsoDate(mustIsoDate('2024-03-01'), -1), '2024-02-29');

  assert.equal(formatMonthLabel(mustYearMonth('2026-11')), 'November 2026');
  assert.equal(formatShortMonthLabel(mustYearMonth('2026-11')), 'Nov 2026');
  assert.equal(formatFullDateLabel(mustIsoDate('2026-11-22')), 'Sun, 22 Nov 2026');

  const refToday = mustIsoDate('2026-11-22');
  assert.equal(formatSectionDateLabel(mustIsoDate('2026-11-22'), refToday), 'Today');
  assert.equal(formatSectionDateLabel(mustIsoDate('2026-11-21'), refToday), 'Yesterday');
  assert.equal(formatSectionDateLabel(mustIsoDate('2026-11-19'), refToday), 'Thu, 19 Nov');
  assert.equal(formatSectionDateLabel(mustIsoDate('2025-11-19'), refToday), 'Wed, 19 Nov 2025');
});

test('money formatting and pure integer amount parsing across currencies', () => {
  assert.equal(formatMoney(mustMinor(1_500_000), 'IDR'), 'Rp 1.500.000');
  assert.equal(formatMoney(mustMinor(-1_500_000), 'IDR'), '-Rp 1.500.000');
  assert.equal(formatMoney(ZERO_MINOR_UNITS, 'IDR'), 'Rp 0');
  assert.equal(formatMoney(mustMinor(1_500_000), 'IDR', { showSign: true }), '+Rp 1.500.000');

  assert.equal(formatMoney(mustMinor(1250), 'USD'), '$12.50');
  assert.equal(formatMoney(mustMinor(5), 'USD'), '$0.05');
  assert.equal(formatMoney(mustMinor(-1250), 'USD'), '-$12.50');
  assert.equal(formatMoney(mustMinor(150_025), 'EUR'), '€1.500,25');
  assert.equal(formatMoney(mustMinor(150_025), 'SGD'), 'S$1,500.25');
  assert.equal(formatMoney(mustMinor(150_025), 'GBP'), '£1,500.25');
  assert.equal(formatMoney(mustMinor(1500), 'JPY'), '¥1,500');

  assert.equal(formatInputAmount('1500000', 'IDR'), '1.500.000');
  assert.equal(formatInputAmount('001500', 'IDR'), '1.500');
  assert.equal(formatInputAmount('1234.567', 'USD'), '1,234.56');
  assert.equal(formatInputAmount('.5', 'USD'), '0.5');
  assert.equal(formatInputAmount('1234.', 'USD'), '1,234.');
  assert.equal(formatInputAmount('1234,5', 'EUR'), '1.234,5');
  assert.equal(formatInputAmount('12.', 'EUR'), '12,');
  assert.equal(formatInputAmount('1.234.', 'EUR'), '1.234,');
  assert.equal(formatInputAmount('.', 'EUR'), '0,');
  assert.equal(formatInputAmount('1.23', 'EUR'), '123');
  assert.equal(formatEditableAmount(mustPos(1250), 'USD'), '12.50');
  assert.equal(formatEditableAmount(mustPos(1_500_000), 'IDR'), '1.500.000');

  assert.deepEqual(parseAmountInput('1500000', 'IDR'), { ok: true, value: 1_500_000 });
  assert.deepEqual(parseAmountInput('1.500.000', 'IDR'), { ok: true, value: 1_500_000 });
  assert.deepEqual(parseAmountInput('1.50', 'IDR'), { ok: false, error: 'invalid-format' });
  assert.deepEqual(parseAmountInput('1500,50', 'IDR'), { ok: false, error: 'invalid-format' });
  assert.deepEqual(parseAmountInput('', 'IDR'), { ok: false, error: 'empty' });
  assert.deepEqual(parseAmountInput('0', 'IDR'), { ok: false, error: 'zero-or-negative' });
  assert.deepEqual(parseAmountInput('-500', 'IDR'), { ok: false, error: 'zero-or-negative' });

  assert.deepEqual(parseAmountInput('19.99', 'USD'), { ok: true, value: 1999 });
  assert.deepEqual(parseAmountInput('12.5', 'USD'), { ok: true, value: 1250 });
  assert.deepEqual(parseAmountInput('12', 'USD'), { ok: true, value: 1200 });
  assert.deepEqual(parseAmountInput('.50', 'USD'), { ok: true, value: 50 });
  assert.deepEqual(parseAmountInput('1,234.56', 'USD'), { ok: true, value: 123_456 });
  assert.deepEqual(parseAmountInput('12.345', 'USD'), { ok: false, error: 'invalid-format' });
  assert.deepEqual(parseAmountInput('12,50', 'USD'), { ok: false, error: 'invalid-format' });
  assert.deepEqual(parseAmountInput('0.00', 'USD'), { ok: false, error: 'zero-or-negative' });

  assert.deepEqual(parseAmountInput('1.234,56', 'EUR'), { ok: true, value: 123_456 });

  assert.deepEqual(parseAmountInput(String(MAX_MONEY_MINOR_UNITS), 'IDR'), {
    ok: true,
    value: MAX_MONEY_MINOR_UNITS,
  });
  assert.deepEqual(parseAmountInput('100000000000001', 'IDR'), {
    ok: false,
    error: 'too-large',
  });
});

test('budget status integer cross-multiplication and spent percentage edge cases', () => {
  assert.deepEqual(evaluateBudgetStatus(mustMinor(500_000), null), { kind: 'unconfigured' });

  const limit = mustPos(1_000_000);
  const okStatus = evaluateBudgetStatus(mustMinor(799_999), limit);
  assert.equal(okStatus.kind, 'ok');
  if (okStatus.kind === 'ok') {
    assert.equal(okStatus.percent, 79);
    assert.equal(okStatus.remaining, 200_001);
  }

  const warnExact = evaluateBudgetStatus(mustMinor(800_000), limit);
  assert.equal(warnExact.kind, 'warning');
  if (warnExact.kind === 'warning') {
    assert.equal(warnExact.percent, 80);
    assert.equal(warnExact.remaining, 200_000);
  }

  const reached = evaluateBudgetStatus(mustMinor(1_000_000), limit);
  assert.equal(reached.kind, 'reached');

  const exceeded = evaluateBudgetStatus(mustMinor(1_250_000), limit);
  assert.equal(exceeded.kind, 'exceeded');
  if (exceeded.kind === 'exceeded') {
    assert.equal(exceeded.overage, 250_000);
    assert.equal(exceeded.percent, 125);
  }

  const maxBelow80 = evaluateBudgetStatus(
    mustMinor(79_999_999_999_999),
    MAX_MONEY_MINOR_UNITS,
  );
  assert.equal(maxBelow80.kind, 'ok');

  assert.deepEqual(spentPercentage(ZERO_MINOR_UNITS, ZERO_MINOR_UNITS), {
    kind: 'no-income',
    hasExpenses: false,
  });
  assert.deepEqual(spentPercentage(ZERO_MINOR_UNITS, mustMinor(500)), {
    kind: 'no-income',
    hasExpenses: true,
  });
  assert.deepEqual(spentPercentage(mustMinor(1_000_000), mustMinor(650_000)), {
    kind: 'within-budget',
    percent: 65,
    ratio: 0.65,
  });
  assert.deepEqual(spentPercentage(mustMinor(1_000_000), mustMinor(1_250_000)), {
    kind: 'over-budget',
    percent: 125,
    ratio: 1.25,
  });
});

test('monthly aggregations, carry-over, grouping, filtering, breakdown, and comparison', () => {
  const transactions: readonly Transaction[] = [
    makeIncome('t_jan_inc', 5_000_000, '2026-01-01'),
    makeExpense('t_jan_exp', 2_000_000, '2026-01-15', BILLS_CAT.id, 'Rent'),
    makeIncome('t_feb_inc', 10_000_000, '2026-02-01'),
    makeExpense('t_feb_exp_1', 3_000_000, '2026-02-05', BILLS_CAT.id, 'Rent'),
    makeExpense('t_feb_exp_2', 1_000_000, '2026-02-10', FOOD_CAT.id, 'Groceries'),
    makeIncome('t_mar_inc', 8_000_000, '2026-03-01'),
    makeExpense('t_mar_exp_1', 600_000, '2026-03-05', FOOD_CAT.id, 'Dinner', '2026-03-05T19:00:00.000Z'),
    makeExpense('t_mar_exp_2', 250_000, '2026-03-05', FOOD_CAT.id, 'Coffee', '2026-03-05T09:00:00.000Z'),
    makeExpense('t_mar_exp_3', 2_000_000, '2026-03-02', BILLS_CAT.id, 'Utilities'),
  ];

  assert.equal(totalIncome(transactions), 23_000_000);
  assert.equal(totalExpenses(transactions), 8_850_000);
  assert.equal(remainingBalance(mustMinor(8_000_000), mustMinor(2_850_000)), 5_150_000);
  assert.equal(carryOverBalance(transactions, mustYearMonth('2026-03')), 9_000_000);

  const filteredFood = filterTransactions(transactions, {
    type: 'expense',
    categoryId: FOOD_CAT.id,
  });
  assert.equal(filteredFood.length, 3);

  const marSummaryNoCarry = summarizeMonth(
    mustYearMonth('2026-03'),
    transactions,
    TEST_CATEGORIES,
    false,
  );
  assert.equal(marSummaryNoCarry.income, 8_000_000);
  assert.equal(marSummaryNoCarry.expenses, 2_850_000);
  assert.equal(marSummaryNoCarry.balance, 5_150_000);
  assert.equal(marSummaryNoCarry.carryOverFromPrevious, 0);
  assert.equal(marSummaryNoCarry.effectiveBalance, 5_150_000);

  const marSummaryWithCarry = summarizeMonth(
    mustYearMonth('2026-03'),
    transactions,
    TEST_CATEGORIES,
    true,
  );
  assert.equal(marSummaryWithCarry.carryOverFromPrevious, 9_000_000);
  assert.equal(marSummaryWithCarry.effectiveBalance, 14_150_000);

  const marDailyGroups = groupTransactionsByDate(marSummaryWithCarry.transactions);
  assert.equal(marDailyGroups.length, 3);
  assert.equal(marDailyGroups[0]?.date, '2026-03-05');
  assert.equal(marDailyGroups[0]?.transactions[0]?.id, 't_mar_exp_1');
  assert.equal(marDailyGroups[0]?.expenses, 850_000);

  assert.equal(marSummaryWithCarry.expenseBreakdown.length, 2);
  assert.equal(marSummaryWithCarry.expenseBreakdown[0]?.category.id, BILLS_CAT.id);
  assert.equal(marSummaryWithCarry.expenseBreakdown[0]?.total, 2_000_000);
  assert.equal(marSummaryWithCarry.expenseBreakdown[1]?.category.id, FOOD_CAT.id);
  assert.equal(marSummaryWithCarry.expenseBreakdown[1]?.budgetStatus.kind, 'warning');

  assert.equal(marSummaryWithCarry.comparison.kind, 'lower');
  if (marSummaryWithCarry.comparison.kind === 'lower') {
    assert.equal(marSummaryWithCarry.comparison.difference, 1_150_000);
    assert.equal(marSummaryWithCarry.comparison.percentageChange, 29);
  }

  const janComparison = monthOverMonthComparison(mustYearMonth('2026-01'), transactions);
  assert.equal(janComparison.kind, 'no-previous-data');

  const grouped = groupTransactionsByDate(transactions.slice(-3));
  assert.equal(grouped.length, 2);
  const breakdown = categorySpendingBreakdown(transactions.slice(-4), TEST_CATEGORIES);
  assert.equal(breakdown.length, 2);
});

test('CSV serialization enforces header, RFC-4180 quoting, and formula injection neutralization', () => {
  const formulaCategory: ExpenseCategory = {
    id: mustCatId('cat_expense_formula'),
    name: '=HYPERLINK("http://evil.test")',
    type: 'expense',
    icon: 'pricetag-outline',
    color: mustHex('#DC2626'),
    isDefault: false,
    monthlyBudget: null,
    sortOrder: 99,
  };
  const transactions: readonly Transaction[] = [
    makeExpense('tx_1', 150_025, '2026-11-22', FOOD_CAT.id, 'Coffee, "special"\nline2'),
    makeIncome('tx_2', 200_000, '2026-11-21', 'Bonus'),
    makeExpense('tx_3', 5_000, '2026-11-20', formulaCategory.id, '=CMD()'),
    makeExpense('tx_4', 5_000, '2026-11-19', FOOD_CAT.id, '+1+1'),
    makeExpense('tx_5', 5_000, '2026-11-18', FOOD_CAT.id, '-100'),
    makeExpense('tx_6', 5_000, '2026-11-17', FOOD_CAT.id, '@SUM(A1)'),
  ];

  const csvUsd = serializeTransactionsToCsv(
    transactions,
    [...TEST_CATEGORIES, formulaCategory],
    'USD',
  );
  const lines = csvUsd.split('\r\n');
  assert.equal(lines[0], 'Date,Type,Category,Amount,Note');
  assert.equal(
    lines[1],
    '2026-11-22,expense,Food,"$1,500.25","Coffee, ""special""\nline2"',
  );
  assert.equal(lines[2], '2026-11-21,income,Salary,"$2,000.00",Bonus');
  assert.equal(
    lines[3],
    '2026-11-20,expense,"\'=HYPERLINK(""http://evil.test"")",$50.00,\'=CMD()',
  );
  assert.equal(lines[4], '2026-11-19,expense,Food,$50.00,\'+1+1');
  assert.equal(lines[5], '2026-11-18,expense,Food,$50.00,\'-100');
  assert.equal(lines[6], '2026-11-17,expense,Food,$50.00,\'@SUM(A1)');
});

test('buildMonthCalendarGrid builds exact Sunday-first local calendar grids without shifts', () => {
  assert.deepEqual(CALENDAR_WEEKDAY_LABELS, ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sat']);

  const feb2026 = buildMonthCalendarGrid(mustYearMonth('2026-02'));
  assert.equal(feb2026.length, 28);
  assert.equal(feb2026[0], '2026-02-01');
  assert.equal(feb2026[27], '2026-02-28');
  assert.equal(feb2026.every((cell) => cell !== null), true);

  const feb2024 = buildMonthCalendarGrid(mustYearMonth('2024-02'));
  assert.equal(feb2024.length, 35);
  assert.deepEqual(feb2024.slice(0, 4), [null, null, null, null]);
  assert.equal(feb2024[4], '2024-02-01');
  assert.equal(feb2024[32], '2024-02-29');
  assert.deepEqual(feb2024.slice(33), [null, null]);

  const aug2026 = buildMonthCalendarGrid(mustYearMonth('2026-08'));
  assert.equal(aug2026.length, 42);
  assert.deepEqual(aug2026.slice(0, 6), [null, null, null, null, null, null]);
  assert.equal(aug2026[6], '2026-08-01');
  assert.equal(aug2026[36], '2026-08-31');
  assert.deepEqual(aug2026.slice(37), [null, null, null, null, null]);

  const may2026 = buildMonthCalendarGrid(mustYearMonth('2026-05'));
  assert.equal(may2026.length, 42);
  assert.equal(may2026[5], '2026-05-01');
  assert.equal(may2026[35], '2026-05-31');

  const nov2026 = buildMonthCalendarGrid(mustYearMonth('2026-11'));
  assert.equal(nov2026.length, 35);
  assert.equal(nov2026[0], '2026-11-01');
  assert.equal(nov2026[29], '2026-11-30');
  assert.deepEqual(nov2026.slice(30), [null, null, null, null, null]);

  for (const monthCode of ['2024-02', '2026-02', '2026-05', '2026-08', '2026-11']) {
    const month = mustYearMonth(monthCode);
    const grid = buildMonthCalendarGrid(month);
    assert.equal(grid.length % 7, 0);
    const nonNull = grid.filter((cell): cell is IsoDate => cell !== null);
    assert.equal(nonNull.length, daysInYearMonth(month));
    nonNull.forEach((date, idx) => {
      const expectedDay = String(idx + 1).padStart(2, '0');
      assert.equal(date, `${month}-${expectedDay}`);
    });
  }
});

test('parseReceiptUri and parseTransactionDraft normalize and validate receipt URIs', () => {
  assert.deepEqual(parseReceiptUri(undefined), { ok: true, value: null });
  assert.deepEqual(parseReceiptUri(null), { ok: true, value: null });
  assert.deepEqual(parseReceiptUri(''), { ok: true, value: null });
  assert.deepEqual(parseReceiptUri('   \t\n '), { ok: true, value: null });
  assert.deepEqual(parseReceiptUri('  file:///docs/receipts/r1.jpg  '), {
    ok: true,
    value: 'file:///docs/receipts/r1.jpg',
  });

  const maxLengthUri = `file:///${'a'.repeat(MAX_RECEIPT_URI_LENGTH - 8)}`;
  assert.equal(maxLengthUri.length, MAX_RECEIPT_URI_LENGTH);
  assert.deepEqual(parseReceiptUri(maxLengthUri), { ok: true, value: maxLengthUri });
  assert.deepEqual(parseReceiptUri(`${maxLengthUri}x`), {
    ok: false,
    error: 'invalid-receipt',
  });
  assert.deepEqual(parseReceiptUri(123), { ok: false, error: 'invalid-receipt' });
  assert.deepEqual(parseReceiptUri({ uri: 'file:///a.jpg' }), {
    ok: false,
    error: 'invalid-receipt',
  });

  const omitted = parseTransactionDraft(
    {
      type: 'expense',
      amountText: '50000',
      categoryId: FOOD_CAT.id,
      date: '2026-11-22',
      note: 'Coffee',
      currency: 'IDR',
    },
    TEST_CATEGORIES,
  );
  assert.equal(omitted.ok, true);
  if (omitted.ok) {
    assert.equal(omitted.value.receiptUri, null);
  }

  const whitespaceReceipt = parseTransactionDraft(
    {
      type: 'expense',
      amountText: '50000',
      categoryId: FOOD_CAT.id,
      date: '2026-11-22',
      note: 'Coffee',
      currency: 'IDR',
      receiptUri: '   ',
    },
    TEST_CATEGORIES,
  );
  assert.equal(whitespaceReceipt.ok, true);
  if (whitespaceReceipt.ok) {
    assert.equal(whitespaceReceipt.value.receiptUri, null);
  }

  const validReceipt = parseTransactionDraft(
    {
      type: 'expense',
      amountText: '50000',
      categoryId: FOOD_CAT.id,
      date: '2026-11-22',
      note: 'Coffee',
      currency: 'IDR',
      receiptUri: '  file:///docs/receipts/coffee.png  ',
    },
    TEST_CATEGORIES,
  );
  assert.equal(validReceipt.ok, true);
  if (validReceipt.ok) {
    assert.equal(validReceipt.value.receiptUri, 'file:///docs/receipts/coffee.png');
  }

  const oversizedReceipt = parseTransactionDraft(
    {
      type: 'expense',
      amountText: '50000',
      categoryId: FOOD_CAT.id,
      date: '2026-11-22',
      note: 'Coffee',
      currency: 'IDR',
      receiptUri: `${maxLengthUri}x`,
    },
    TEST_CATEGORIES,
  );
  assert.equal(oversizedReceipt.ok, false);
  if (!oversizedReceipt.ok) {
    assert.equal(oversizedReceipt.error.receiptUri, 'invalid-receipt');
  }
});

test('extractSafeReceiptExtension and isManagedReceiptUri validate receipt paths and extensions', () => {
  assert.equal(extractSafeReceiptExtension('file:///tmp/photo.jpg'), '.jpg');
  assert.equal(extractSafeReceiptExtension('file:///tmp/photo.jpeg'), '.jpeg');
  assert.equal(extractSafeReceiptExtension('file:///tmp/photo.png'), '.png');
  assert.equal(extractSafeReceiptExtension('file:///tmp/photo.webp'), '.webp');
  assert.equal(extractSafeReceiptExtension('file:///tmp/photo.heic'), '.heic');
  assert.equal(extractSafeReceiptExtension('file:///tmp/PHOTO.PNG'), '.png');
  assert.equal(
    extractSafeReceiptExtension('https://example.com/receipt.WEBP?size=large#view'),
    '.webp',
  );
  assert.equal(extractSafeReceiptExtension('file:///tmp/payload.exe'), '.jpg');
  assert.equal(extractSafeReceiptExtension('file:///tmp/diagram.svg'), '.jpg');
  assert.equal(extractSafeReceiptExtension('file:///tmp/noext'), '.jpg');
  assert.equal(extractSafeReceiptExtension('file:///tmp/dir.v1/noext'), '.jpg');
  assert.equal(extractSafeReceiptExtension(''), '.jpg');

  assert.equal(isManagedReceiptUri('file:///documents/receipts/receipt_1.jpg'), true);
  assert.equal(isManagedReceiptUri('  file:///documents/receipts/r.png  '), true);
  assert.equal(isManagedReceiptUri(null), false);
  assert.equal(isManagedReceiptUri(''), false);
  assert.equal(isManagedReceiptUri('   '), false);
  assert.equal(isManagedReceiptUri('file:///documents/photos/receipt_1.jpg'), false);
  assert.equal(isManagedReceiptUri('file:///documents/receipts/../secret.jpg'), false);
});
