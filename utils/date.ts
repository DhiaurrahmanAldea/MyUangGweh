import {
  daysInGregorianMonth,
  parseIsoDate,
  parseYearMonth,
  type IsoDate,
  type YearMonth,
} from '../types/domain';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const SHORT_WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const CALENDAR_WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sat'] as const;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function splitYearMonth(month: YearMonth): { readonly year: number; readonly month: number } {
  const [yearStr, monthStr] = month.split('-');
  return {
    year: Number(yearStr),
    month: Number(monthStr),
  };
}

function splitIsoDate(date: IsoDate): {
  readonly year: number;
  readonly month: number;
  readonly day: number;
} {
  const [yearStr, monthStr, dayStr] = date.split('-');
  return {
    year: Number(yearStr),
    month: Number(monthStr),
    day: Number(dayStr),
  };
}

function requireIsoDate(candidate: string): IsoDate {
  const parsed = parseIsoDate(candidate);
  if (parsed === null) {
    throw new RangeError(`Invalid ISO date produced: ${candidate}`);
  }
  return parsed;
}

function requireYearMonth(candidate: string): YearMonth {
  const parsed = parseYearMonth(candidate);
  if (parsed === null) {
    throw new RangeError(`Invalid YearMonth produced: ${candidate}`);
  }
  return parsed;
}

export function todayIsoDate(now: Date = new Date()): IsoDate {
  const year = now.getFullYear();
  const month = pad2(now.getMonth() + 1);
  const day = pad2(now.getDate());
  return requireIsoDate(`${year}-${month}-${day}`);
}

export function currentYearMonth(now: Date = new Date()): YearMonth {
  const year = now.getFullYear();
  const month = pad2(now.getMonth() + 1);
  return requireYearMonth(`${year}-${month}`);
}

export function isoDateToYearMonth(date: IsoDate): YearMonth {
  return requireYearMonth(date.slice(0, 7));
}

export function stepYearMonth(month: YearMonth, deltaMonths: number): YearMonth {
  const { year, month: monthNumber } = splitYearMonth(month);
  const totalMonths = year * 12 + (monthNumber - 1) + Math.trunc(deltaMonths);
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = ((totalMonths % 12) + 12) % 12 + 1;
  return requireYearMonth(`${nextYear}-${pad2(nextMonth)}`);
}

export function monthDateRange(month: YearMonth): {
  readonly start: IsoDate;
  readonly nextStart: IsoDate;
} {
  const start = requireIsoDate(`${month}-01`);
  const nextMonth = stepYearMonth(month, 1);
  const nextStart = requireIsoDate(`${nextMonth}-01`);
  return { start, nextStart };
}

export function daysInYearMonth(month: YearMonth): number {
  const { year, month: monthNumber } = splitYearMonth(month);
  return daysInGregorianMonth(year, monthNumber);
}

export function buildMonthCalendarGrid(month: YearMonth): readonly (IsoDate | null)[] {
  const { year, month: monthNumber } = splitYearMonth(month);
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const totalDays = daysInYearMonth(month);
  const cells: (IsoDate | null)[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(requireIsoDate(`${month}-${pad2(day)}`));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function clampDayToMonth(month: YearMonth, dayOfMonth: number): IsoDate {
  const maxDay = daysInYearMonth(month);
  const clamped = Math.min(Math.max(Math.trunc(dayOfMonth), 1), maxDay);
  return requireIsoDate(`${month}-${pad2(clamped)}`);
}

export function shiftIsoDate(date: IsoDate, deltaDays: number): IsoDate {
  const { year, month, day } = splitIsoDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + Math.trunc(deltaDays)));
  const nextYear = shifted.getUTCFullYear();
  const nextMonth = pad2(shifted.getUTCMonth() + 1);
  const nextDay = pad2(shifted.getUTCDate());
  return requireIsoDate(`${nextYear}-${nextMonth}-${nextDay}`);
}

export function formatMonthLabel(month: YearMonth): string {
  const { year, month: monthNumber } = splitYearMonth(month);
  const name = MONTH_NAMES[monthNumber - 1] ?? '';
  return `${name} ${year}`;
}

export function formatShortMonthLabel(month: YearMonth): string {
  const { year, month: monthNumber } = splitYearMonth(month);
  const name = SHORT_MONTH_NAMES[monthNumber - 1] ?? '';
  return `${name} ${year}`;
}

export function formatFullDateLabel(date: IsoDate): string {
  const { year, month, day } = splitIsoDate(date);
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const weekday = SHORT_WEEKDAY_NAMES[weekdayIndex] ?? '';
  const shortMonth = SHORT_MONTH_NAMES[month - 1] ?? '';
  return `${weekday}, ${day} ${shortMonth} ${year}`;
}

export function formatSectionDateLabel(
  date: IsoDate,
  referenceToday: IsoDate = todayIsoDate(),
): string {
  if (date === referenceToday) {
    return 'Today';
  }
  if (date === shiftIsoDate(referenceToday, -1)) {
    return 'Yesterday';
  }
  const { year, month, day } = splitIsoDate(date);
  const { year: refYear } = splitIsoDate(referenceToday);
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const weekday = SHORT_WEEKDAY_NAMES[weekdayIndex] ?? '';
  const shortMonth = SHORT_MONTH_NAMES[month - 1] ?? '';
  if (year === refYear) {
    return `${weekday}, ${day} ${shortMonth}`;
  }
  return `${weekday}, ${day} ${shortMonth} ${year}`;
}
