import type { Category, CategoryId, CurrencyCode, Transaction } from '../types/domain';
import { formatMoney } from './money';

const CSV_HEADER = 'Date,Type,Category,Amount,Note';
const FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r]/;

function sanitizeCsvText(value: string): string {
  return FORMULA_PREFIX_PATTERN.test(value) ? `'${value}` : value;
}

function escapeCsvField(value: string): string {
  if (
    value.includes('"') ||
    value.includes(',') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeTransactionsToCsv(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  currency: CurrencyCode,
): string {
  const categoryNames = new Map<CategoryId, string>();
  for (const category of categories) {
    categoryNames.set(category.id, category.name);
  }

  const lines: string[] = [CSV_HEADER];

  for (const transaction of transactions) {
    const categoryName = categoryNames.get(transaction.categoryId) ?? 'Other';
    const formattedAmount = formatMoney(transaction.amount, currency);
    const fields = [
      transaction.date,
      transaction.type,
      sanitizeCsvText(categoryName),
      formattedAmount,
      sanitizeCsvText(transaction.note),
    ].map(escapeCsvField);
    lines.push(fields.join(','));
  }

  return lines.join('\r\n');
}
