import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import type {
  AppSettings,
  Category,
  ExpenseCategory,
  IncomeCategory,
  MonthSummary,
  RecurringRule,
  Transaction,
  TransactionId,
  TransactionType,
  YearMonth,
} from '../types/domain';
import { currentYearMonth, stepYearMonth } from '../utils/date';
import { createBudgetStore, initDatabase, type BudgetStore } from './store';

const DATABASE_NAME = 'pocket_ledger.db';

export interface SelectedMonthState {
  readonly selectedMonth: YearMonth;
  readonly setSelectedMonth: (month: YearMonth) => void;
  readonly stepSelectedMonth: (deltaMonths: number) => void;
  readonly resetToCurrentMonth: () => void;
}

interface BudgetContextValue extends SelectedMonthState {
  readonly store: BudgetStore;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

async function handleInitDatabase(db: SQLiteDatabase): Promise<void> {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  initDatabase(db, { seedDevData: isDev });
}

function BudgetStoreProvider({ children }: { readonly children: React.ReactNode }) {
  const db = useSQLiteContext();
  const store = useMemo(() => createBudgetStore(db), [db]);
  const [selectedMonth, setSelectedMonth] = useState<YearMonth>(() => currentYearMonth());

  useEffect(() => {
    const todayMonth = currentYearMonth();
    store.materializeRecurringThrough(
      selectedMonth <= todayMonth ? selectedMonth : todayMonth,
    );
  }, [store, selectedMonth]);

  const stepSelectedMonth = useCallback((deltaMonths: number) => {
    setSelectedMonth((previous) => stepYearMonth(previous, deltaMonths));
  }, []);

  const resetToCurrentMonth = useCallback(() => {
    setSelectedMonth(currentYearMonth());
  }, []);

  const value = useMemo<BudgetContextValue>(
    () => ({
      store,
      selectedMonth,
      setSelectedMonth,
      stepSelectedMonth,
      resetToCurrentMonth,
    }),
    [store, selectedMonth, stepSelectedMonth, resetToCurrentMonth],
  );

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function BudgetProvider({ children }: { readonly children: React.ReactNode }) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={handleInitDatabase}>
      <BudgetStoreProvider>{children}</BudgetStoreProvider>
    </SQLiteProvider>
  );
}

function useBudgetContext(): BudgetContextValue {
  const context = useContext(BudgetContext);
  if (context === null) {
    throw new Error('Budget hooks must be used within a <BudgetProvider>');
  }
  return context;
}

export function useBudgetStore(): BudgetStore {
  return useBudgetContext().store;
}

export function useSelectedMonth(): SelectedMonthState {
  const { selectedMonth, setSelectedMonth, stepSelectedMonth, resetToCurrentMonth } =
    useBudgetContext();
  return useMemo(
    () => ({
      selectedMonth,
      setSelectedMonth,
      stepSelectedMonth,
      resetToCurrentMonth,
    }),
    [selectedMonth, setSelectedMonth, stepSelectedMonth, resetToCurrentMonth],
  );
}

export function useMonthSummary(month?: YearMonth): MonthSummary {
  const { store, selectedMonth } = useBudgetContext();
  const targetMonth = month ?? selectedMonth;
  return useSyncExternalStore(
    store.subscribe,
    useCallback(() => store.getMonthSummary(targetMonth), [store, targetMonth]),
  );
}

export function useTransaction(id: TransactionId | null): Transaction | null {
  const store = useBudgetStore();
  return useSyncExternalStore(
    store.subscribe,
    useCallback(() => (id === null ? null : store.getTransaction(id)), [store, id]),
  );
}

export function useTransactionCount(): number {
  const store = useBudgetStore();
  return useSyncExternalStore(store.subscribe, store.getTransactionCount);
}

export function useCategories(type: 'expense'): readonly ExpenseCategory[];
export function useCategories(type: 'income'): readonly IncomeCategory[];
export function useCategories(type?: TransactionType): readonly Category[];
export function useCategories(type?: TransactionType): readonly Category[] {
  const store = useBudgetStore();
  const categories = useSyncExternalStore(store.subscribe, store.getCategories);

  return useMemo(() => {
    if (type === 'expense') {
      return categories.filter((category): category is ExpenseCategory => category.type === 'expense');
    }
    if (type === 'income') {
      return categories.filter((category): category is IncomeCategory => category.type === 'income');
    }
    return categories;
  }, [categories, type]);
}

export function useSettings(): AppSettings {
  const store = useBudgetStore();
  return useSyncExternalStore(store.subscribe, store.getSettings);
}

export function useRecurringRules(): readonly RecurringRule[] {
  const store = useBudgetStore();
  return useSyncExternalStore(store.subscribe, store.getRecurringRules);
}
