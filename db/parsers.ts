import {
  parseCategoryIcon,
  parseCategoryId,
  parseCurrencyCode,
  parseHexColor,
  parseIsoDate,
  parseIsoTimestamp,
  parsePositiveMinorUnits,
  parseReceiptUri,
  parseRecurringRuleId,
  parseThemePreference,
  parseTransactionId,
  parseTransactionType,
  parseYearMonth,
  type AppSettings,
  type Category,
  type RecurringRule,
  type RecurringRuleId,
  type Transaction,
  type YearMonth,
} from '../types/domain';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectRecord(row: unknown, context: string): Record<string, unknown> {
  if (!isRecord(row)) {
    throw new Error(`Expected object row for ${context}`);
  }
  return row;
}

function expectNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid non-empty string for ${field}`);
  }
  return value;
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid string for ${field}`);
  }
  return value;
}

function expectInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`Invalid integer for ${field}`);
  }
  return value;
}

function expectSqliteBoolean(value: unknown, field: string): boolean {
  if (value !== 0 && value !== 1) {
    throw new Error(`Invalid SQLite boolean (0|1) for ${field}`);
  }
  return value === 1;
}

function expectParsed<T>(parsed: T | null, field: string): T {
  if (parsed === null) {
    throw new Error(`Failed domain validation for ${field}`);
  }
  return parsed;
}

export function parseUserVersionRow(row: unknown): number {
  const record = expectRecord(row, 'PRAGMA user_version');
  return expectInteger(record.user_version, 'user_version');
}

export function parseCountRow(row: unknown): number {
  const record = expectRecord(row, 'COUNT(*)');
  return expectInteger(record.count, 'count');
}

export function parseTableInfoColumnName(row: unknown): string {
  const record = expectRecord(row, 'PRAGMA table_info');
  return expectNonEmptyString(record.name, 'table_info.name');
}

export function parseCategoryRow(row: unknown): Category {
  const record = expectRecord(row, 'category');
  const id = expectParsed(parseCategoryId(record.id), 'category.id');
  const name = expectNonEmptyString(record.name, 'category.name');
  const type = expectParsed(parseTransactionType(record.type), 'category.type');
  const icon = expectParsed(parseCategoryIcon(record.icon), 'category.icon');
  const color = expectParsed(parseHexColor(record.color), 'category.color');
  const isDefault = expectSqliteBoolean(record.is_default, 'category.is_default');
  const sortOrder = expectInteger(record.sort_order, 'category.sort_order');

  if (type === 'income') {
    if (record.monthly_budget !== null && record.monthly_budget !== undefined) {
      throw new Error('Income category cannot define monthly_budget');
    }
    return {
      id,
      name,
      type: 'income',
      icon,
      color,
      isDefault,
      sortOrder,
    };
  }

  const monthlyBudget =
    record.monthly_budget === null || record.monthly_budget === undefined
      ? null
      : expectParsed(parsePositiveMinorUnits(record.monthly_budget), 'category.monthly_budget');

  return {
    id,
    name,
    type: 'expense',
    icon,
    color,
    isDefault,
    monthlyBudget,
    sortOrder,
  };
}

export function parseTransactionRow(row: unknown): Transaction {
  const record = expectRecord(row, 'transaction');
  const id = expectParsed(parseTransactionId(record.id), 'transaction.id');
  const type = expectParsed(parseTransactionType(record.type), 'transaction.type');
  const amount = expectParsed(parsePositiveMinorUnits(record.amount), 'transaction.amount');
  const categoryId = expectParsed(parseCategoryId(record.category_id), 'transaction.category_id');
  const date = expectParsed(parseIsoDate(record.date), 'transaction.date');
  const note = expectString(record.note, 'transaction.note');
  const createdAt = expectParsed(parseIsoTimestamp(record.created_at), 'transaction.created_at');

  const recurringRuleId =
    record.recurring_rule_id === null || record.recurring_rule_id === undefined
      ? null
      : expectParsed(
          parseRecurringRuleId(record.recurring_rule_id),
          'transaction.recurring_rule_id',
        );

  const recurringMonth =
    record.recurring_month === null || record.recurring_month === undefined
      ? null
      : expectParsed(parseYearMonth(record.recurring_month), 'transaction.recurring_month');

  const receiptResult = parseReceiptUri(record.receipt_uri);
  if (!receiptResult.ok) {
    throw new Error('Failed domain validation for transaction.receipt_uri');
  }
  const receiptUri = receiptResult.value;

  if (type === 'income') {
    return {
      id,
      type: 'income',
      amount,
      categoryId,
      date,
      note,
      createdAt,
      recurringRuleId,
      recurringMonth,
      receiptUri,
    };
  }

  return {
    id,
    type: 'expense',
    amount,
    categoryId,
    date,
    note,
    createdAt,
    recurringRuleId,
    recurringMonth,
    receiptUri,
  };
}

export function parseRecurringRuleRow(row: unknown): RecurringRule {
  const record = expectRecord(row, 'recurring_rule');
  const id = expectParsed(parseRecurringRuleId(record.id), 'recurring_rule.id');
  const type = expectParsed(parseTransactionType(record.type), 'recurring_rule.type');
  const amount = expectParsed(parsePositiveMinorUnits(record.amount), 'recurring_rule.amount');
  const categoryId = expectParsed(
    parseCategoryId(record.category_id),
    'recurring_rule.category_id',
  );
  const dayOfMonth = expectInteger(record.day_of_month, 'recurring_rule.day_of_month');
  if (dayOfMonth < 1 || dayOfMonth > 31) {
    throw new Error(`Invalid day_of_month for recurring_rule: ${dayOfMonth}`);
  }
  const note = expectString(record.note, 'recurring_rule.note');
  const startMonth = expectParsed(parseYearMonth(record.start_month), 'recurring_rule.start_month');
  const isActive = expectSqliteBoolean(record.is_active, 'recurring_rule.is_active');
  const createdAt = expectParsed(
    parseIsoTimestamp(record.created_at),
    'recurring_rule.created_at',
  );

  return {
    id,
    type,
    amount,
    categoryId,
    dayOfMonth,
    note,
    startMonth,
    isActive,
    createdAt,
  };
}

export function parseSettingsRow(row: unknown): AppSettings {
  const record = expectRecord(row, 'settings');
  const currency = expectParsed(parseCurrencyCode(record.currency), 'settings.currency');
  const carryOverEnabled = expectSqliteBoolean(
    record.carry_over_enabled,
    'settings.carry_over_enabled',
  );
  const theme = expectParsed(parseThemePreference(record.theme), 'settings.theme');
  const devSeeded = expectSqliteBoolean(record.dev_seeded, 'settings.dev_seeded');

  return {
    currency,
    carryOverEnabled,
    theme,
    devSeeded,
  };
}

export function parseRecurringSkipRow(row: unknown): {
  readonly recurringRuleId: RecurringRuleId;
  readonly recurringMonth: YearMonth;
} {
  const record = expectRecord(row, 'recurring_skip');
  const recurringRuleId = expectParsed(
    parseRecurringRuleId(record.recurring_rule_id),
    'recurring_skip.recurring_rule_id',
  );
  const recurringMonth = expectParsed(
    parseYearMonth(record.recurring_month),
    'recurring_skip.recurring_month',
  );
  return { recurringRuleId, recurringMonth };
}
