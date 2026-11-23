declare const BrandTag: unique symbol;

type Brand<Base, Tags extends Readonly<Record<string, true>>> = Base & {
  readonly [BrandTag]: Tags;
};

export type TransactionId = Brand<string, { readonly TransactionId: true }>;
export type CategoryId = Brand<string, { readonly CategoryId: true }>;
export type RecurringRuleId = Brand<string, { readonly RecurringRuleId: true }>;
export type MinorUnits = Brand<number, { readonly MinorUnits: true }>;
export type PositiveMinorUnits = Brand<
  number,
  { readonly MinorUnits: true; readonly PositiveMinorUnits: true }
>;
export type IsoDate = Brand<string, { readonly IsoDate: true }>;
export type YearMonth = Brand<string, { readonly YearMonth: true }>;
export type IsoTimestamp = Brand<string, { readonly IsoTimestamp: true }>;
export type HexColor = Brand<string, { readonly HexColor: true }>;

export const ZERO_MINOR_UNITS = 0 as MinorUnits;
export const MAX_MONEY_MINOR_UNITS = 100_000_000_000_000 as PositiveMinorUnits;
export const MAX_NOTE_LENGTH = 200;
export const MAX_CATEGORY_NAME_LENGTH = 40;
export const MAX_RECEIPT_URI_LENGTH = 2048;

export type TransactionType = 'income' | 'expense';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface CurrencyConfig {
  readonly code: CurrencyCode;
  readonly symbol: string;
  readonly symbolPosition: 'prefix' | 'prefix-space';
  readonly decimals: 0 | 2;
  readonly thousandsSeparator: '.' | ',';
  readonly decimalSeparator: '.' | ',';
  readonly label: string;
}

export const CURRENCY_CODES = ['IDR', 'USD', 'EUR', 'SGD', 'GBP', 'JPY'] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];
export const DEFAULT_CURRENCY: CurrencyCode = 'IDR';

export const CURRENCIES = {
  IDR: {
    code: 'IDR',
    symbol: 'Rp',
    symbolPosition: 'prefix-space',
    decimals: 0,
    thousandsSeparator: '.',
    decimalSeparator: ',',
    label: 'Indonesian Rupiah',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    symbolPosition: 'prefix',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    label: 'US Dollar',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    symbolPosition: 'prefix',
    decimals: 2,
    thousandsSeparator: '.',
    decimalSeparator: ',',
    label: 'Euro',
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    symbolPosition: 'prefix',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    label: 'Singapore Dollar',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    symbolPosition: 'prefix',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    label: 'British Pound',
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    symbolPosition: 'prefix',
    decimals: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    label: 'Japanese Yen',
  },
} as const satisfies Record<CurrencyCode, CurrencyConfig>;

export const CATEGORY_ICONS = [
  'restaurant-outline',
  'car-outline',
  'receipt-outline',
  'bag-handle-outline',
  'heart-outline',
  'film-outline',
  'ellipsis-horizontal-circle-outline',
  'wallet-outline',
  'briefcase-outline',
  'gift-outline',
  'home-outline',
  'cafe-outline',
  'book-outline',
  'airplane-outline',
  'pricetag-outline',
  'fitness-outline',
  'school-outline',
  'cart-outline',
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

interface CategoryBase {
  readonly id: CategoryId;
  readonly name: string;
  readonly icon: CategoryIcon;
  readonly color: HexColor;
  readonly isDefault: boolean;
  readonly sortOrder: number;
}

export interface ExpenseCategory extends CategoryBase {
  readonly type: 'expense';
  readonly monthlyBudget: PositiveMinorUnits | null;
}

export interface IncomeCategory extends CategoryBase {
  readonly type: 'income';
}

export type Category = ExpenseCategory | IncomeCategory;

interface TransactionBase {
  readonly id: TransactionId;
  readonly amount: PositiveMinorUnits;
  readonly categoryId: CategoryId;
  readonly date: IsoDate;
  readonly note: string;
  readonly createdAt: IsoTimestamp;
  readonly recurringRuleId: RecurringRuleId | null;
  readonly recurringMonth: YearMonth | null;
  readonly receiptUri: string | null;
}

export interface IncomeTransaction extends TransactionBase {
  readonly type: 'income';
}

export interface ExpenseTransaction extends TransactionBase {
  readonly type: 'expense';
}

export type Transaction = IncomeTransaction | ExpenseTransaction;

export interface AppSettings {
  readonly currency: CurrencyCode;
  readonly carryOverEnabled: boolean;
  readonly theme: ThemePreference;
  readonly devSeeded: boolean;
}

export interface RecurringRule {
  readonly id: RecurringRuleId;
  readonly type: TransactionType;
  readonly amount: PositiveMinorUnits;
  readonly categoryId: CategoryId;
  readonly dayOfMonth: number;
  readonly note: string;
  readonly startMonth: YearMonth;
  readonly isActive: boolean;
  readonly createdAt: IsoTimestamp;
}

export interface TransactionFilter {
  readonly type?: TransactionType | 'all';
  readonly categoryId?: CategoryId | null;
}

export type SpentProgress =
  | { readonly kind: 'no-income'; readonly hasExpenses: boolean }
  | { readonly kind: 'within-budget'; readonly percent: number; readonly ratio: number }
  | { readonly kind: 'over-budget'; readonly percent: number; readonly ratio: number };

export type BudgetStatus =
  | { readonly kind: 'unconfigured' }
  | {
      readonly kind: 'ok';
      readonly spent: MinorUnits;
      readonly limit: PositiveMinorUnits;
      readonly percent: number;
      readonly remaining: MinorUnits;
    }
  | {
      readonly kind: 'warning';
      readonly spent: MinorUnits;
      readonly limit: PositiveMinorUnits;
      readonly percent: number;
      readonly remaining: MinorUnits;
    }
  | {
      readonly kind: 'reached';
      readonly spent: MinorUnits;
      readonly limit: PositiveMinorUnits;
      readonly percent: 100;
    }
  | {
      readonly kind: 'exceeded';
      readonly spent: MinorUnits;
      readonly limit: PositiveMinorUnits;
      readonly percent: number;
      readonly overage: PositiveMinorUnits;
    };

export type MonthComparison =
  | {
      readonly kind: 'no-previous-data';
      readonly currentExpenses: MinorUnits;
      readonly previousMonth: YearMonth;
    }
  | {
      readonly kind: 'higher';
      readonly currentExpenses: MinorUnits;
      readonly previousExpenses: MinorUnits;
      readonly difference: PositiveMinorUnits;
      readonly percentageChange: number | null;
      readonly previousMonth: YearMonth;
    }
  | {
      readonly kind: 'lower';
      readonly currentExpenses: MinorUnits;
      readonly previousExpenses: MinorUnits;
      readonly difference: PositiveMinorUnits;
      readonly percentageChange: number | null;
      readonly previousMonth: YearMonth;
    }
  | {
      readonly kind: 'same';
      readonly currentExpenses: MinorUnits;
      readonly previousExpenses: MinorUnits;
      readonly previousMonth: YearMonth;
    };

export interface DailyTransactionGroup {
  readonly date: IsoDate;
  readonly income: MinorUnits;
  readonly expenses: MinorUnits;
  readonly transactions: readonly Transaction[];
}

export interface CategoryBreakdownItem {
  readonly category: ExpenseCategory;
  readonly total: PositiveMinorUnits;
  readonly percentage: number;
  readonly transactionCount: number;
  readonly budgetStatus: BudgetStatus;
}

export interface MonthSummary {
  readonly month: YearMonth;
  readonly income: MinorUnits;
  readonly expenses: MinorUnits;
  readonly balance: MinorUnits;
  readonly carryOverFromPrevious: MinorUnits;
  readonly effectiveBalance: MinorUnits;
  readonly spentProgress: SpentProgress;
  readonly transactions: readonly Transaction[];
  readonly recentTransactions: readonly Transaction[];
  readonly expenseBreakdown: readonly CategoryBreakdownItem[];
  readonly comparison: MonthComparison;
}

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type AmountError = 'empty' | 'invalid-format' | 'zero-or-negative' | 'too-large';

export interface RawTransactionInput {
  readonly id?: TransactionId;
  readonly type: TransactionType;
  readonly amountText: string;
  readonly categoryId: CategoryId | null;
  readonly date: string;
  readonly note: string;
  readonly currency: CurrencyCode;
  readonly receiptUri?: string | null;
}

export interface ValidatedTransactionDraft {
  readonly id?: TransactionId;
  readonly type: TransactionType;
  readonly amount: PositiveMinorUnits;
  readonly categoryId: CategoryId;
  readonly date: IsoDate;
  readonly note: string;
  readonly receiptUri: string | null;
}

export interface TransactionValidationErrors {
  readonly amount?: AmountError;
  readonly categoryId?: 'required' | 'category-type-mismatch' | 'not-found';
  readonly date?: 'invalid-date';
  readonly note?: 'too-long';
  readonly receiptUri?: 'invalid-receipt';
}

export interface RawCategoryInput {
  readonly id?: CategoryId;
  readonly type: TransactionType;
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly monthlyBudgetText?: string;
  readonly currency: CurrencyCode;
}

export type ValidatedCategoryDraft =
  | {
      readonly id?: CategoryId;
      readonly type: 'expense';
      readonly name: string;
      readonly icon: CategoryIcon;
      readonly color: HexColor;
      readonly monthlyBudget: PositiveMinorUnits | null;
    }
  | {
      readonly id?: CategoryId;
      readonly type: 'income';
      readonly name: string;
      readonly icon: CategoryIcon;
      readonly color: HexColor;
    };

export interface CategoryValidationErrors {
  readonly name?: 'empty' | 'too-long' | 'duplicate';
  readonly icon?: 'invalid-icon';
  readonly color?: 'invalid-color';
  readonly monthlyBudget?: AmountError | 'income-cannot-have-budget';
}

export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${String(value)}`);
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function daysInGregorianMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeap ? 29 : 28;
  }
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }
  return 31;
}

export function parseTransactionId(value: unknown): TransactionId | null {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    return null;
  }
  return value as TransactionId;
}

export function parseCategoryId(value: unknown): CategoryId | null {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    return null;
  }
  return value as CategoryId;
}

export function parseRecurringRuleId(value: unknown): RecurringRuleId | null {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    return null;
  }
  return value as RecurringRuleId;
}

export function parseMinorUnits(value: unknown): MinorUnits | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    return null;
  }
  return value as MinorUnits;
}

export function parsePositiveMinorUnits(value: unknown): PositiveMinorUnits | null {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > MAX_MONEY_MINOR_UNITS
  ) {
    return null;
  }
  return value as PositiveMinorUnits;
}

export function toComputedMinorUnits(value: number): MinorUnits {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Expected safe integer minor units, received ${value}`);
  }
  return value as MinorUnits;
}

export function toComputedPositiveMinorUnits(value: number): PositiveMinorUnits {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`Expected positive safe integer minor units, received ${value}`);
  }
  return value as PositiveMinorUnits;
}

export function parseIsoDate(value: unknown): IsoDate | null {
  if (typeof value !== 'string') {
    return null;
  }
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 9999 || month < 1 || month > 12) {
    return null;
  }
  const maxDay = daysInGregorianMonth(year, month);
  if (day < 1 || day > maxDay) {
    return null;
  }
  return value as IsoDate;
}

export function parseYearMonth(value: unknown): YearMonth | null {
  if (typeof value !== 'string') {
    return null;
  }
  const match = YEAR_MONTH_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1900 || year > 9999 || month < 1 || month > 12) {
    return null;
  }
  return value as YearMonth;
}

export function parseIsoTimestamp(value: unknown): IsoTimestamp | null {
  if (typeof value !== 'string' || value.length === 0 || !value.includes('T')) {
    return null;
  }
  if (Number.isNaN(Date.parse(value))) {
    return null;
  }
  return value as IsoTimestamp;
}

export function parseHexColor(value: unknown): HexColor | null {
  if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
    return null;
  }
  return value.toUpperCase() as HexColor;
}

export function parseCurrencyCode(value: unknown): CurrencyCode | null {
  if (typeof value !== 'string') {
    return null;
  }
  for (const code of CURRENCY_CODES) {
    if (code === value) {
      return code;
    }
  }
  return null;
}

export function parseCategoryIcon(value: unknown): CategoryIcon | null {
  if (typeof value !== 'string') {
    return null;
  }
  for (const icon of CATEGORY_ICONS) {
    if (icon === value) {
      return icon;
    }
  }
  return null;
}

export function parseTransactionType(value: unknown): TransactionType | null {
  if (value === 'income' || value === 'expense') {
    return value;
  }
  return null;
}

export function parseThemePreference(value: unknown): ThemePreference | null {
  if (value === 'system' || value === 'light' || value === 'dark') {
    return value;
  }
  return null;
}

export function parseReceiptUri(
  value: unknown,
): Result<string | null, 'invalid-receipt'> {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false, error: 'invalid-receipt' };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (trimmed.length > MAX_RECEIPT_URI_LENGTH) {
    return { ok: false, error: 'invalid-receipt' };
  }
  return { ok: true, value: trimmed };
}

const ALLOWED_RECEIPT_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
]);

export function extractSafeReceiptExtension(sourceUri: string): string {
  const withoutQuery = sourceUri.trim().split(/[?#]/)[0] ?? '';
  const lastDotIndex = withoutQuery.lastIndexOf('.');
  const lastSlashIndex = withoutQuery.lastIndexOf('/');
  if (lastDotIndex <= lastSlashIndex || lastDotIndex < 0) {
    return '.jpg';
  }
  const candidate = withoutQuery.slice(lastDotIndex).toLowerCase();
  return ALLOWED_RECEIPT_EXTENSIONS.has(candidate) ? candidate : '.jpg';
}

export function isManagedReceiptUri(uri: string | null): uri is string {
  if (uri === null) {
    return false;
  }
  const trimmed = uri.trim();
  return (
    trimmed.length > 0 &&
    trimmed.includes('/receipts/') &&
    !trimmed.includes('..')
  );
}

function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseAmountInput(
  text: string,
  currency: CurrencyCode,
): Result<PositiveMinorUnits, AmountError> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'empty' };
  }

  const config = CURRENCIES[currency];
  const thousandsSep = config.thousandsSeparator;
  const decimalSep = config.decimalSeparator;
  const escapedThousands = escapeRegex(thousandsSep);
  const groupedIntRegex = new RegExp(`^\\d{1,3}(?:${escapedThousands}\\d{3})+$`);
  const plainIntRegex = /^\d+$/;

  const isNegative = trimmed.startsWith('-');
  const unsigned = isNegative ? trimmed.slice(1).trim() : trimmed;
  if (unsigned.length === 0) {
    return { ok: false, error: 'invalid-format' };
  }

  const decimalParts = unsigned.split(decimalSep);
  if (decimalParts.length > 2) {
    return { ok: false, error: 'invalid-format' };
  }

  const rawIntPart = decimalParts[0] ?? '';
  const rawFracPart = decimalParts.length === 2 ? decimalParts[1] : undefined;

  if (config.decimals === 0 && rawFracPart !== undefined) {
    return { ok: false, error: 'invalid-format' };
  }

  if (rawFracPart !== undefined) {
    if (rawFracPart.length === 0 || rawFracPart.length > config.decimals) {
      return { ok: false, error: 'invalid-format' };
    }
    if (!plainIntRegex.test(rawFracPart)) {
      return { ok: false, error: 'invalid-format' };
    }
  }

  let intDigits: string;
  if (rawIntPart.length === 0) {
    if (rawFracPart === undefined) {
      return { ok: false, error: 'invalid-format' };
    }
    intDigits = '0';
  } else if (plainIntRegex.test(rawIntPart)) {
    intDigits = rawIntPart;
  } else if (groupedIntRegex.test(rawIntPart)) {
    intDigits = rawIntPart.split(thousandsSep).join('');
  } else {
    return { ok: false, error: 'invalid-format' };
  }

  const fracDigits =
    config.decimals === 0 ? '' : (rawFracPart ?? '').padEnd(config.decimals, '0');
  const minorUnitsBigInt = BigInt(`${intDigits}${fracDigits}`);

  if (isNegative || minorUnitsBigInt <= 0n) {
    return { ok: false, error: 'zero-or-negative' };
  }

  if (minorUnitsBigInt > BigInt(MAX_MONEY_MINOR_UNITS)) {
    return { ok: false, error: 'too-large' };
  }

  return { ok: true, value: Number(minorUnitsBigInt) as PositiveMinorUnits };
}

export function parseTransactionDraft(
  raw: RawTransactionInput,
  categories?: readonly Category[],
): Result<ValidatedTransactionDraft, TransactionValidationErrors> {
  let hasErrors = false;
  let amountError: TransactionValidationErrors['amount'];
  let categoryError: TransactionValidationErrors['categoryId'];
  let dateError: TransactionValidationErrors['date'];
  let noteError: TransactionValidationErrors['note'];
  let receiptError: TransactionValidationErrors['receiptUri'];

  const amountResult = parseAmountInput(raw.amountText, raw.currency);
  if (!amountResult.ok) {
    amountError = amountResult.error;
    hasErrors = true;
  }

  if (raw.categoryId === null) {
    categoryError = 'required';
    hasErrors = true;
  } else if (categories !== undefined) {
    const matched = categories.find((category) => category.id === raw.categoryId);
    if (!matched) {
      categoryError = 'not-found';
      hasErrors = true;
    } else if (matched.type !== raw.type) {
      categoryError = 'category-type-mismatch';
      hasErrors = true;
    }
  }

  const parsedDate = parseIsoDate(raw.date.trim());
  if (parsedDate === null) {
    dateError = 'invalid-date';
    hasErrors = true;
  }

  const trimmedNote = raw.note.trim();
  if (trimmedNote.length > MAX_NOTE_LENGTH) {
    noteError = 'too-long';
    hasErrors = true;
  }

  const receiptResult = parseReceiptUri(raw.receiptUri);
  if (!receiptResult.ok) {
    receiptError = receiptResult.error;
    hasErrors = true;
  }

  if (
    hasErrors ||
    !amountResult.ok ||
    raw.categoryId === null ||
    parsedDate === null ||
    !receiptResult.ok
  ) {
    return {
      ok: false,
      error: {
        ...(amountError ? { amount: amountError } : {}),
        ...(categoryError ? { categoryId: categoryError } : {}),
        ...(dateError ? { date: dateError } : {}),
        ...(noteError ? { note: noteError } : {}),
        ...(receiptError ? { receiptUri: receiptError } : {}),
      },
    };
  }

  return {
    ok: true,
    value: {
      ...(raw.id !== undefined ? { id: raw.id } : {}),
      type: raw.type,
      amount: amountResult.value,
      categoryId: raw.categoryId,
      date: parsedDate,
      note: trimmedNote,
      receiptUri: receiptResult.value,
    },
  };
}

export function parseCategoryDraft(
  raw: RawCategoryInput,
  existingCategories?: readonly Category[],
): Result<ValidatedCategoryDraft, CategoryValidationErrors> {
  let hasErrors = false;
  let nameError: CategoryValidationErrors['name'];
  let iconError: CategoryValidationErrors['icon'];
  let colorError: CategoryValidationErrors['color'];
  let budgetError: CategoryValidationErrors['monthlyBudget'];

  const trimmedName = raw.name.trim();
  if (trimmedName.length === 0) {
    nameError = 'empty';
    hasErrors = true;
  } else if (trimmedName.length > MAX_CATEGORY_NAME_LENGTH) {
    nameError = 'too-long';
    hasErrors = true;
  } else if (existingCategories !== undefined) {
    const normalizedName = trimmedName.toLowerCase();
    const duplicate = existingCategories.some(
      (category) =>
        category.type === raw.type &&
        category.id !== raw.id &&
        category.name.trim().toLowerCase() === normalizedName,
    );
    if (duplicate) {
      nameError = 'duplicate';
      hasErrors = true;
    }
  }

  const parsedIcon = parseCategoryIcon(raw.icon.trim());
  if (parsedIcon === null) {
    iconError = 'invalid-icon';
    hasErrors = true;
  }

  const parsedColor = parseHexColor(raw.color.trim());
  if (parsedColor === null) {
    colorError = 'invalid-color';
    hasErrors = true;
  }

  let parsedBudget: PositiveMinorUnits | null = null;
  const trimmedBudget = raw.monthlyBudgetText?.trim() ?? '';
  if (trimmedBudget.length > 0) {
    if (raw.type === 'income') {
      budgetError = 'income-cannot-have-budget';
      hasErrors = true;
    } else {
      const budgetResult = parseAmountInput(trimmedBudget, raw.currency);
      if (!budgetResult.ok) {
        budgetError = budgetResult.error;
        hasErrors = true;
      } else {
        parsedBudget = budgetResult.value;
      }
    }
  }

  if (hasErrors || parsedIcon === null || parsedColor === null) {
    return {
      ok: false,
      error: {
        ...(nameError ? { name: nameError } : {}),
        ...(iconError ? { icon: iconError } : {}),
        ...(colorError ? { color: colorError } : {}),
        ...(budgetError ? { monthlyBudget: budgetError } : {}),
      },
    };
  }

  if (raw.type === 'expense') {
    return {
      ok: true,
      value: {
        ...(raw.id !== undefined ? { id: raw.id } : {}),
        type: 'expense',
        name: trimmedName,
        icon: parsedIcon,
        color: parsedColor,
        monthlyBudget: parsedBudget,
      },
    };
  }

  return {
    ok: true,
    value: {
      ...(raw.id !== undefined ? { id: raw.id } : {}),
      type: 'income',
      name: trimmedName,
      icon: parsedIcon,
      color: parsedColor,
    },
  };
}
