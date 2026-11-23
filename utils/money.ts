import {
  CURRENCIES,
  ZERO_MINOR_UNITS,
  assertNever,
  parseAmountInput,
  toComputedMinorUnits,
  toComputedPositiveMinorUnits,
  type AmountError,
  type BudgetStatus,
  type Category,
  type CategoryBreakdownItem,
  type CategoryId,
  type CurrencyCode,
  type DailyTransactionGroup,
  type ExpenseCategory,
  type MinorUnits,
  type MonthComparison,
  type MonthSummary,
  type PositiveMinorUnits,
  type SpentProgress,
  type Transaction,
  type TransactionFilter,
  type YearMonth,
} from '../types/domain';
import { monthDateRange, stepYearMonth } from './date';

export { parseAmountInput };

const RECENT_TRANSACTION_LIMIT = 5;

function groupDigits(intPart: string, separator: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

function stripLeadingZeros(digits: string): string {
  if (digits.length <= 1) {
    return digits;
  }
  const stripped = digits.replace(/^0+/, '');
  return stripped.length === 0 ? '0' : stripped;
}

function compareTransactionsDescending(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) {
    return a.date > b.date ? -1 : 1;
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt > b.createdAt ? -1 : 1;
  }
  if (a.id !== b.id) {
    return a.id > b.id ? -1 : 1;
  }
  return 0;
}

export function formatMoney(
  amount: MinorUnits,
  currency: CurrencyCode,
  options?: { readonly showSign?: boolean },
): string {
  const config = CURRENCIES[currency];
  const raw = BigInt(Math.trunc(amount));
  const isNegative = raw < 0n;
  const abs = isNegative ? -raw : raw;

  let intPart: string;
  let fracPart = '';
  if (config.decimals === 0) {
    intPart = abs.toString();
  } else {
    const scale = 10n ** BigInt(config.decimals);
    intPart = (abs / scale).toString();
    fracPart = (abs % scale).toString().padStart(config.decimals, '0');
  }

  const groupedInt = groupDigits(intPart, config.thousandsSeparator);
  const formattedNumber =
    config.decimals > 0 ? `${groupedInt}${config.decimalSeparator}${fracPart}` : groupedInt;
  const prefix = config.symbolPosition === 'prefix-space' ? `${config.symbol} ` : config.symbol;

  if (isNegative) {
    return `-${prefix}${formattedNumber}`;
  }
  if (options?.showSign && raw > 0n) {
    return `+${prefix}${formattedNumber}`;
  }
  return `${prefix}${formattedNumber}`;
}

export function formatInputAmount(raw: string, currency: CurrencyCode): string {
  const config = CURRENCIES[currency];
  if (config.decimals === 0) {
    const digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly.length === 0) {
      return '';
    }
    return groupDigits(stripLeadingZeros(digitsOnly), config.thousandsSeparator);
  }

  const decimalSep = config.decimalSeparator;
  const normalizedRaw =
    decimalSep === ',' && !raw.includes(',') && raw.endsWith('.')
      ? `${raw.slice(0, -1)},`
      : raw;
  let seenDecimal = false;
  let rawInt = '';
  let rawFrac = '';

  for (const ch of normalizedRaw) {
    if (ch >= '0' && ch <= '9') {
      if (seenDecimal) {
        if (rawFrac.length < config.decimals) {
          rawFrac += ch;
        }
      } else {
        rawInt += ch;
      }
    } else if (ch === decimalSep && !seenDecimal) {
      seenDecimal = true;
    }
  }

  if (!seenDecimal) {
    if (rawInt.length === 0) {
      return '';
    }
    return groupDigits(stripLeadingZeros(rawInt), config.thousandsSeparator);
  }

  const normalizedInt = rawInt.length === 0 ? '0' : stripLeadingZeros(rawInt);
  const groupedInt = groupDigits(normalizedInt, config.thousandsSeparator);
  return `${groupedInt}${decimalSep}${rawFrac}`;
}

export function formatEditableAmount(amount: PositiveMinorUnits, currency: CurrencyCode): string {
  const config = CURRENCIES[currency];
  const raw = BigInt(amount);
  if (config.decimals === 0) {
    return groupDigits(raw.toString(), config.thousandsSeparator);
  }
  const scale = 10n ** BigInt(config.decimals);
  const intPart = groupDigits((raw / scale).toString(), config.thousandsSeparator);
  const fracPart = (raw % scale).toString().padStart(config.decimals, '0');
  return `${intPart}${config.decimalSeparator}${fracPart}`;
}

export function totalIncome(transactions: readonly Transaction[]): MinorUnits {
  let sum = 0;
  for (const transaction of transactions) {
    if (transaction.type === 'income') {
      sum += transaction.amount;
    }
  }
  return toComputedMinorUnits(sum);
}

export function totalExpenses(transactions: readonly Transaction[]): MinorUnits {
  let sum = 0;
  for (const transaction of transactions) {
    if (transaction.type === 'expense') {
      sum += transaction.amount;
    }
  }
  return toComputedMinorUnits(sum);
}

export function remainingBalance(income: MinorUnits, expenses: MinorUnits): MinorUnits {
  return toComputedMinorUnits(income - expenses);
}

export function carryOverBalance(
  allTransactions: readonly Transaction[],
  beforeMonth: YearMonth,
): MinorUnits {
  const { start } = monthDateRange(beforeMonth);
  let net = 0;
  for (const transaction of allTransactions) {
    if (transaction.date < start) {
      net += transaction.type === 'income' ? transaction.amount : -transaction.amount;
    }
  }
  return toComputedMinorUnits(net);
}

export function spentPercentage(income: MinorUnits, expenses: MinorUnits): SpentProgress {
  if (income <= 0) {
    return {
      kind: 'no-income',
      hasExpenses: expenses > 0,
    };
  }

  const ratio = expenses / income;
  const roundedPercent = Number((BigInt(expenses) * 100n + BigInt(income) / 2n) / BigInt(income));

  if (expenses <= income) {
    return {
      kind: 'within-budget',
      percent: Math.min(100, roundedPercent),
      ratio,
    };
  }

  return {
    kind: 'over-budget',
    percent: Math.max(100, roundedPercent),
    ratio,
  };
}

export function evaluateBudgetStatus(
  spent: MinorUnits,
  limit: PositiveMinorUnits | null,
): BudgetStatus {
  if (limit === null) {
    return { kind: 'unconfigured' };
  }

  const spentBig = BigInt(spent);
  const limitBig = BigInt(limit);
  const percent = Number((spentBig * 100n) / limitBig);

  if (spentBig > limitBig) {
    return {
      kind: 'exceeded',
      spent,
      limit,
      percent,
      overage: toComputedPositiveMinorUnits(spent - limit),
    };
  }

  if (spentBig === limitBig) {
    return {
      kind: 'reached',
      spent,
      limit,
      percent: 100,
    };
  }

  const remaining = toComputedMinorUnits(limit - spent);
  if (spentBig * 100n >= limitBig * 80n) {
    return {
      kind: 'warning',
      spent,
      limit,
      percent,
      remaining,
    };
  }

  return {
    kind: 'ok',
    spent,
    limit,
    percent,
    remaining,
  };
}

export function filterTransactions(
  transactions: readonly Transaction[],
  filter: TransactionFilter,
): Transaction[] {
  const filterType = filter.type && filter.type !== 'all' ? filter.type : null;
  const filterCategoryId = filter.categoryId ?? null;

  return transactions.filter((transaction) => {
    if (filterType !== null && transaction.type !== filterType) {
      return false;
    }
    if (filterCategoryId !== null && transaction.categoryId !== filterCategoryId) {
      return false;
    }
    return true;
  });
}

export function groupTransactionsByDate(
  transactions: readonly Transaction[],
): DailyTransactionGroup[] {
  const sorted = [...transactions].sort(compareTransactionsDescending);
  const groups: DailyTransactionGroup[] = [];

  for (const transaction of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === transaction.date) {
      const mutableTransactions = [...last.transactions, transaction];
      const nextIncome =
        transaction.type === 'income'
          ? toComputedMinorUnits(last.income + transaction.amount)
          : last.income;
      const nextExpenses =
        transaction.type === 'expense'
          ? toComputedMinorUnits(last.expenses + transaction.amount)
          : last.expenses;
      groups[groups.length - 1] = {
        date: last.date,
        income: nextIncome,
        expenses: nextExpenses,
        transactions: mutableTransactions,
      };
    } else {
      groups.push({
        date: transaction.date,
        income:
          transaction.type === 'income'
            ? toComputedMinorUnits(transaction.amount)
            : ZERO_MINOR_UNITS,
        expenses:
          transaction.type === 'expense'
            ? toComputedMinorUnits(transaction.amount)
            : ZERO_MINOR_UNITS,
        transactions: [transaction],
      });
    }
  }

  return groups;
}

export function categorySpendingBreakdown(
  transactions: readonly Transaction[],
  categories: readonly Category[],
): CategoryBreakdownItem[] {
  const expenseCategoriesById = new Map<CategoryId, ExpenseCategory>();
  for (const category of categories) {
    if (category.type === 'expense') {
      expenseCategoriesById.set(category.id, category);
    }
  }

  const totals = new Map<CategoryId, { total: number; count: number }>();
  let grandTotal = 0;

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') {
      continue;
    }
    if (!expenseCategoriesById.has(transaction.categoryId)) {
      continue;
    }
    const existing = totals.get(transaction.categoryId);
    if (existing) {
      existing.total += transaction.amount;
      existing.count += 1;
    } else {
      totals.set(transaction.categoryId, { total: transaction.amount, count: 1 });
    }
    grandTotal += transaction.amount;
  }

  if (grandTotal <= 0) {
    return [];
  }

  const items: CategoryBreakdownItem[] = [];
  for (const [categoryId, entry] of totals.entries()) {
    const category = expenseCategoriesById.get(categoryId);
    if (!category || entry.total <= 0) {
      continue;
    }
    const total = toComputedPositiveMinorUnits(entry.total);
    const percentage = Math.round((entry.total / grandTotal) * 1000) / 10;
    items.push({
      category,
      total,
      percentage,
      transactionCount: entry.count,
      budgetStatus: evaluateBudgetStatus(total, category.monthlyBudget),
    });
  }

  items.sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }
    return a.category.sortOrder - b.category.sortOrder;
  });

  return items;
}

export function monthOverMonthComparison(
  selectedMonth: YearMonth,
  allTransactions: readonly Transaction[],
): MonthComparison {
  const previousMonth = stepYearMonth(selectedMonth, -1);
  const currentRange = monthDateRange(selectedMonth);
  const previousRange = monthDateRange(previousMonth);

  const currentTransactions: Transaction[] = [];
  const previousTransactions: Transaction[] = [];

  for (const transaction of allTransactions) {
    if (transaction.date >= currentRange.start && transaction.date < currentRange.nextStart) {
      currentTransactions.push(transaction);
    } else if (
      transaction.date >= previousRange.start &&
      transaction.date < previousRange.nextStart
    ) {
      previousTransactions.push(transaction);
    }
  }

  const currentExpenses = totalExpenses(currentTransactions);
  if (previousTransactions.length === 0) {
    return {
      kind: 'no-previous-data',
      currentExpenses,
      previousMonth,
    };
  }

  const previousExpenses = totalExpenses(previousTransactions);
  if (currentExpenses > previousExpenses) {
    const difference = toComputedPositiveMinorUnits(currentExpenses - previousExpenses);
    const percentageChange =
      previousExpenses > 0 ? Math.round((difference / previousExpenses) * 100) : null;
    return {
      kind: 'higher',
      currentExpenses,
      previousExpenses,
      difference,
      percentageChange,
      previousMonth,
    };
  }

  if (currentExpenses < previousExpenses) {
    const difference = toComputedPositiveMinorUnits(previousExpenses - currentExpenses);
    const percentageChange = Math.round((difference / previousExpenses) * 100);
    return {
      kind: 'lower',
      currentExpenses,
      previousExpenses,
      difference,
      percentageChange,
      previousMonth,
    };
  }

  return {
    kind: 'same',
    currentExpenses,
    previousExpenses,
    previousMonth,
  };
}

export function summarizeMonth(
  selectedMonth: YearMonth,
  allTransactions: readonly Transaction[],
  categories: readonly Category[],
  carryOverEnabled: boolean,
): MonthSummary {
  const range = monthDateRange(selectedMonth);
  const monthTransactions = allTransactions
    .filter((transaction) => transaction.date >= range.start && transaction.date < range.nextStart)
    .sort(compareTransactionsDescending);

  const income = totalIncome(monthTransactions);
  const expenses = totalExpenses(monthTransactions);
  const balance = remainingBalance(income, expenses);
  const carryOverFromPrevious = carryOverEnabled
    ? carryOverBalance(allTransactions, selectedMonth)
    : ZERO_MINOR_UNITS;
  const effectiveBalance = toComputedMinorUnits(carryOverFromPrevious + balance);

  return {
    month: selectedMonth,
    income,
    expenses,
    balance,
    carryOverFromPrevious,
    effectiveBalance,
    spentProgress: spentPercentage(income, expenses),
    transactions: monthTransactions,
    recentTransactions: monthTransactions.slice(0, RECENT_TRANSACTION_LIMIT),
    expenseBreakdown: categorySpendingBreakdown(monthTransactions, categories),
    comparison: monthOverMonthComparison(selectedMonth, allTransactions),
  };
}

export function getAmountErrorMessage(error: AmountError): string {
  switch (error) {
    case 'empty':
      return 'Enter an amount greater than 0.';
    case 'invalid-format':
      return 'Enter a valid numeric amount.';
    case 'zero-or-negative':
      return 'Amount must be greater than 0.';
    case 'too-large':
      return 'Amount exceeds the maximum supported value.';
    default:
      return assertNever(error);
  }
}
