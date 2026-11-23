import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
  type SectionListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FloatingAddButton } from '../components/FloatingAddButton';
import { MonthHeader } from '../components/MonthHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  SegmentedControl,
  type SegmentedOption,
} from '../components/SegmentedControl';
import { TransactionRow } from '../components/TransactionRow';
import { UndoToast } from '../components/UndoToast';
import {
  useBudgetStore,
  useCategories,
  useMonthSummary,
  useSelectedMonth,
  useSettings,
} from '../db/BudgetProvider';
import {
  assertNever,
  toComputedMinorUnits,
  type Category,
  type CategoryId,
  type CurrencyCode,
  type DailyTransactionGroup,
  type Transaction,
  type TransactionId,
  type TransactionType,
} from '../types/domain';
import type { RootStackNavigationProp } from '../types/navigation';
import { formatMonthLabel, formatSectionDateLabel } from '../utils/date';
import {
  filterTransactions,
  formatMoney,
  groupTransactionsByDate,
  totalExpenses,
  totalIncome,
} from '../utils/money';
import { deleteReceiptImageQuietly } from '../utils/receipt';
import {
  RADIUS,
  SPACING,
  colorWithAlpha,
  useAppTheme,
  useResponsiveLayout,
  type AppTheme,
} from '../utils/theme';
import { useMainTabs } from './MainTabsContext';

type TypeFilterValue = 'all' | TransactionType;

const TYPE_FILTER_OPTIONS: readonly SegmentedOption<TypeFilterValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

interface TransactionSection {
  readonly title: string;
  readonly group: DailyTransactionGroup;
  readonly data: Transaction[];
}

interface DeletedUndoState {
  readonly transaction: Transaction;
  readonly nonce: number;
}

interface FilteredSliceSummary {
  readonly countLabel: string;
  readonly totalDisplay: string;
  readonly totalColor: string;
}

function getFilteredSliceSummary(
  typeFilter: TypeFilterValue,
  categoryFilter: CategoryId | null,
  transactions: readonly Transaction[],
  categoryById: ReadonlyMap<CategoryId, Category>,
  currency: CurrencyCode,
  theme: AppTheme,
): FilteredSliceSummary {
  const count = transactions.length;
  const countLabel = count === 1 ? '1 transaction' : `${count} transactions`;

  switch (typeFilter) {
    case 'expense': {
      const amount = totalExpenses(transactions);
      return {
        countLabel,
        totalDisplay: formatMoney(amount, currency),
        totalColor:
          amount > 0 ? theme.colors.negative : theme.colors.textSecondary,
      };
    }
    case 'income': {
      const amount = totalIncome(transactions);
      return {
        countLabel,
        totalDisplay: formatMoney(amount, currency, { showSign: amount > 0 }),
        totalColor:
          amount > 0 ? theme.colors.positive : theme.colors.textSecondary,
      };
    }
    case 'all': {
      const selectedCategory =
        categoryFilter !== null ? categoryById.get(categoryFilter) : undefined;
      if (selectedCategory?.type === 'expense') {
        const amount = totalExpenses(transactions);
        return {
          countLabel,
          totalDisplay: formatMoney(amount, currency),
          totalColor:
            amount > 0 ? theme.colors.negative : theme.colors.textSecondary,
        };
      }
      if (selectedCategory?.type === 'income') {
        const amount = totalIncome(transactions);
        return {
          countLabel,
          totalDisplay: formatMoney(amount, currency, { showSign: amount > 0 }),
          totalColor:
            amount > 0 ? theme.colors.positive : theme.colors.textSecondary,
        };
      }
      const net = toComputedMinorUnits(
        totalIncome(transactions) - totalExpenses(transactions),
      );
      return {
        countLabel,
        totalDisplay: formatMoney(net, currency, { showSign: net > 0 }),
        totalColor:
          net > 0
            ? theme.colors.positive
            : net < 0
              ? theme.colors.negative
              : theme.colors.textSecondary,
      };
    }
    default:
      return assertNever(typeFilter);
  }
}

export function TransactionsScreen() {
  const theme = useAppTheme();
  const { horizontalPadding } = useResponsiveLayout();
  const navigation = useNavigation<RootStackNavigationProp>();
  const {
    activeTab,
    pendingTransactionsFilter,
    clearPendingTransactionsFilter,
  } = useMainTabs();
  const store = useBudgetStore();
  const settings = useSettings();
  const { selectedMonth, stepSelectedMonth, resetToCurrentMonth } =
    useSelectedMonth();
  const summary = useMonthSummary(selectedMonth);
  const allCategories = useCategories();

  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | null>(null);
  const [openDeleteId, setOpenDeleteId] = useState<TransactionId | null>(null);
  const [deletedUndo, setDeletedUndo] = useState<DeletedUndoState | null>(null);
  const deletedUndoRef = useRef<DeletedUndoState | null>(null);

  useEffect(() => {
    deletedUndoRef.current = deletedUndo;
  }, [deletedUndo]);

  useEffect(() => {
    return () => {
      if (deletedUndoRef.current !== null) {
        deleteReceiptImageQuietly(deletedUndoRef.current.transaction.receiptUri);
      }
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'Transactions') {
      setOpenDeleteId((prev) => (prev === null ? prev : null));
    }
  }, [activeTab]);

  useEffect(() => {
    if (pendingTransactionsFilter === null) {
      return;
    }
    if (
      pendingTransactionsFilter.filterType !== undefined ||
      pendingTransactionsFilter.categoryId !== undefined
    ) {
      setTypeFilter(pendingTransactionsFilter.filterType ?? 'all');
      setCategoryFilter(pendingTransactionsFilter.categoryId ?? null);
    }
    clearPendingTransactionsFilter();
  }, [pendingTransactionsFilter, clearPendingTransactionsFilter]);

  const categoryById = useMemo(() => {
    const map = new Map<CategoryId, Category>();
    for (const category of allCategories) {
      map.set(category.id, category);
    }
    return map;
  }, [allCategories]);

  const filterCategories = useMemo(() => {
    if (typeFilter === 'all') {
      return allCategories;
    }
    return allCategories.filter((category) => category.type === typeFilter);
  }, [allCategories, typeFilter]);

  const handleSelectTypeFilter = useCallback(
    (nextType: TypeFilterValue) => {
      setTypeFilter(nextType);
      if (nextType !== 'all' && categoryFilter !== null) {
        const selected = categoryById.get(categoryFilter);
        if (!selected || selected.type !== nextType) {
          setCategoryFilter(null);
        }
      }
    },
    [categoryById, categoryFilter],
  );

  const filteredTransactions = useMemo(
    () =>
      filterTransactions(summary.transactions, {
        type: typeFilter,
        categoryId: categoryFilter,
      }),
    [summary.transactions, typeFilter, categoryFilter],
  );

  const sections = useMemo<TransactionSection[]>(() => {
    const groups = groupTransactionsByDate(filteredTransactions);
    return groups.map((group) => ({
      title: formatSectionDateLabel(group.date),
      group,
      data: [...group.transactions],
    }));
  }, [filteredTransactions]);

  const handleSwipeDelete = useCallback(
    (transaction: Transaction) => {
      setOpenDeleteId(null);
      const deleted = store.deleteTransaction(transaction.id);
      if (deleted !== null) {
        if (deletedUndoRef.current !== null) {
          deleteReceiptImageQuietly(
            deletedUndoRef.current.transaction.receiptUri,
          );
        }
        const nextUndo: DeletedUndoState = {
          transaction: deleted,
          nonce: Date.now(),
        };
        deletedUndoRef.current = nextUndo;
        setDeletedUndo(nextUndo);
      }
    },
    [store],
  );

  const handleListScrollBeginDrag = useCallback(() => {
    setOpenDeleteId((prev) => (prev === null ? prev : null));
  }, []);

  const handleUndoDelete = useCallback(() => {
    const pending = deletedUndoRef.current;
    if (pending === null) {
      return;
    }
    deletedUndoRef.current = null;
    store.restoreTransaction(pending.transaction);
    setDeletedUndo(null);
  }, [store]);

  const handleDismissToast = useCallback(() => {
    if (deletedUndoRef.current !== null) {
      deleteReceiptImageQuietly(deletedUndoRef.current.transaction.receiptUri);
      deletedUndoRef.current = null;
    }
    setDeletedUndo(null);
  }, []);

  const handleResetFilters = useCallback(() => {
    setTypeFilter('all');
    setCategoryFilter(null);
  }, []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: TransactionSection }) => {
      const dailyNet = toComputedMinorUnits(
        section.group.income - section.group.expenses,
      );
      const netColor =
        dailyNet > 0 ? theme.colors.positive : theme.colors.textSecondary;

      return (
        <ScreenContainer style={{ paddingHorizontal: horizontalPadding }}>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                theme.typography.sectionTitle,
                { color: theme.colors.textSecondary },
              ]}
            >
              {section.title}
            </Text>
            <Text
              style={[
                theme.typography.caption,
                styles.sectionHeaderTotal,
                { color: netColor },
              ]}
            >
              {formatMoney(dailyNet, settings.currency, {
                showSign: dailyNet > 0,
              })}
            </Text>
          </View>
        </ScreenContainer>
      );
    },
    [
      horizontalPadding,
      settings.currency,
      theme.colors.positive,
      theme.colors.textSecondary,
      theme.typography.caption,
      theme.typography.sectionTitle,
    ],
  );

  const renderItem = useCallback(
    ({
      item,
      index,
      section,
    }: SectionListRenderItemInfo<Transaction, TransactionSection>) => {
      const isFirst = index === 0;
      const isLast = index === section.data.length - 1;

      return (
        <ScreenContainer style={{ paddingHorizontal: horizontalPadding }}>
          <View
            style={[
              styles.rowFrame,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
              isFirst && styles.rowFrameFirst,
              isLast && styles.rowFrameLast,
            ]}
          >
            <TransactionRow
              transaction={item}
              category={categoryById.get(item.categoryId)}
              currency={settings.currency}
              showDate={false}
              showDivider={!isLast}
              onPress={(tx) =>
                navigation.navigate('TransactionForm', {
                  mode: 'edit',
                  transactionId: tx.id,
                })
              }
              onSwipeDelete={handleSwipeDelete}
              isDeleteOpen={openDeleteId === item.id}
              onToggleDeleteOpen={setOpenDeleteId}
            />
          </View>
        </ScreenContainer>
      );
    },
    [
      categoryById,
      handleSwipeDelete,
      horizontalPadding,
      navigation,
      openDeleteId,
      settings.currency,
      theme.colors.border,
      theme.colors.surface,
    ],
  );

  const hasActiveFilter = typeFilter !== 'all' || categoryFilter !== null;
  const filteredSummary = useMemo(
    () =>
      hasActiveFilter
        ? getFilteredSliceSummary(
            typeFilter,
            categoryFilter,
            filteredTransactions,
            categoryById,
            settings.currency,
            theme,
          )
        : null,
    [
      categoryById,
      categoryFilter,
      filteredTransactions,
      hasActiveFilter,
      settings.currency,
      theme,
      typeFilter,
    ],
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: theme.colors.canvas }]}
    >
      <MonthHeader
        month={selectedMonth}
        onPrev={() => stepSelectedMonth(-1)}
        onNext={() => stepSelectedMonth(1)}
        onResetToday={resetToCurrentMonth}
        onOpenSettings={() => navigation.navigate('Settings')}
      />

      <View
        style={[
          styles.filtersDividerWrapper,
          { borderBottomColor: theme.colors.divider },
        ]}
      >
        <ScreenContainer style={styles.filtersContainer}>
          <View style={{ paddingHorizontal: horizontalPadding }}>
            <SegmentedControl
              value={typeFilter}
              onChange={handleSelectTypeFilter}
              options={TYPE_FILTER_OPTIONS}
            />
          </View>

          <ScrollView
            horizontal
            nestedScrollEnabled={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.categoryScrollContent,
              { paddingHorizontal: horizontalPadding },
            ]}
          >
            <Pressable
              onPress={() => setCategoryFilter(null)}
              android_ripple={{ color: theme.colors.ripple }}
              style={({ pressed }) => [
                styles.categoryChip,
                {
                  backgroundColor:
                    categoryFilter === null
                      ? theme.colors.accentSoft
                      : Platform.OS !== 'android' && pressed
                        ? theme.colors.surfaceMuted
                        : theme.colors.surface,
                  borderColor:
                    categoryFilter === null
                      ? theme.colors.accent
                      : theme.colors.border,
                },
              ]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityState={{ selected: categoryFilter === null }}
            >
              <Text
                style={[
                  theme.typography.caption,
                  {
                    color:
                      categoryFilter === null
                        ? theme.colors.accent
                        : theme.colors.textSecondary,
                    fontWeight: categoryFilter === null ? '600' : '500',
                  },
                ]}
              >
                All categories
              </Text>
            </Pressable>

            {filterCategories.map((category) => {
              const isSelected = categoryFilter === category.id;
              const selectedFill = colorWithAlpha(
                category.color,
                theme.isDark ? 0.24 : 0.12,
              );
              return (
                <Pressable
                  key={category.id}
                  onPress={() =>
                    setCategoryFilter((prev) =>
                      prev === category.id ? null : category.id,
                    )
                  }
                  android_ripple={{ color: theme.colors.ripple }}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    {
                      backgroundColor: isSelected
                        ? selectedFill
                        : Platform.OS !== 'android' && pressed
                          ? theme.colors.surfaceMuted
                          : theme.colors.surface,
                      borderColor: isSelected
                        ? category.color
                        : theme.colors.border,
                    },
                  ]}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Ionicons
                    name={category.icon}
                    size={15}
                    color={category.color}
                  />
                  <Text
                    style={[
                      theme.typography.caption,
                      {
                        color: isSelected
                          ? theme.colors.text
                          : theme.colors.textSecondary,
                        fontWeight: isSelected ? '600' : '500',
                      },
                    ]}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {filteredSummary !== null ? (
            <View style={{ paddingHorizontal: horizontalPadding }}>
              <View
                style={[
                  styles.filteredSummaryBar,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderRadius: theme.radius.sm,
                  },
                ]}
              >
                <View style={styles.filteredSummaryInfo}>
                  <Text
                    style={[
                      theme.typography.caption,
                      styles.filteredSummaryCount,
                      { color: theme.colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {filteredSummary.countLabel}
                  </Text>
                  <Text
                    style={[
                      theme.typography.micro,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    ·
                  </Text>
                  <Text
                    style={[
                      theme.typography.bodyStrong,
                      styles.filteredSummaryTotal,
                      { color: filteredSummary.totalColor },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {filteredSummary.totalDisplay}
                  </Text>
                </View>

                <Pressable
                  onPress={handleResetFilters}
                  android_ripple={{ color: theme.colors.ripple }}
                  style={({ pressed }) => [
                    styles.resetFilterButton,
                    Platform.OS !== 'android' &&
                      pressed &&
                      styles.resetFilterButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Reset filters"
                >
                  <Text
                    style={[
                      theme.typography.caption,
                      styles.resetFilterText,
                      { color: theme.colors.accent },
                    ]}
                  >
                    Reset
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScreenContainer>
      </View>

      <SectionList
        style={styles.flex}
        sections={sections}
        extraData={openDeleteId}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        nestedScrollEnabled={true}
        onScrollBeginDrag={handleListScrollBeginDrag}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.listContent,
          sections.length === 0 && [
            styles.emptyListContent,
            { paddingHorizontal: horizontalPadding },
          ],
        ]}
        ListEmptyComponent={
          <ScreenContainer>
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: theme.colors.surfaceMuted },
                ]}
              >
                <Ionicons
                  name={hasActiveFilter ? 'funnel-outline' : 'receipt-outline'}
                  size={24}
                  color={theme.colors.textSecondary}
                />
              </View>

              <Text
                style={[
                  theme.typography.sectionTitle,
                  styles.emptyTitle,
                  { color: theme.colors.text },
                ]}
              >
                {hasActiveFilter
                  ? 'No matching transactions'
                  : `No transactions in ${formatMonthLabel(selectedMonth)}`}
              </Text>

              <Text
                style={[
                  theme.typography.caption,
                  styles.emptySubtitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {hasActiveFilter
                  ? 'Try clearing your type or category filter.'
                  : 'Tap + to add your first transaction for this month.'}
              </Text>

              {hasActiveFilter ? (
                <Pressable
                  onPress={handleResetFilters}
                  android_ripple={{ color: theme.colors.ripple }}
                  style={({ pressed }) => [
                    styles.emptyActionButton,
                    {
                      backgroundColor:
                        Platform.OS !== 'android' && pressed
                          ? theme.colors.surfaceMuted
                          : theme.colors.accentSoft,
                    },
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      theme.typography.bodyStrong,
                      { color: theme.colors.accent },
                    ]}
                  >
                    Clear filters
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </ScreenContainer>
        }
      />

      <UndoToast
        visible={deletedUndo !== null}
        message="Transaction deleted"
        toastKey={
          deletedUndo
            ? `${deletedUndo.transaction.id}_${deletedUndo.nonce}`
            : undefined
        }
        onUndo={handleUndoDelete}
        onDismiss={handleDismissToast}
        bottomOffset={88}
      />

      <FloatingAddButton
        onPress={() =>
          navigation.navigate('TransactionForm', {
            mode: 'create',
            ...(typeFilter !== 'all' ? { initialType: typeFilter } : {}),
          })
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  filtersDividerWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filtersContainer: {
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    gap: 10,
  },
  categoryScrollContent: {
    gap: SPACING.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    overflow: 'hidden',
  },
  filteredSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    paddingVertical: 2,
    gap: SPACING.sm,
  },
  filteredSummaryInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filteredSummaryCount: {
    fontVariant: ['tabular-nums'],
  },
  filteredSummaryTotal: {
    flexShrink: 1,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  resetFilterButton: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetFilterButtonPressed: {
    opacity: 0.7,
  },
  resetFilterText: {
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 104,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  sectionHeaderTotal: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  rowFrame: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  rowFrameFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  rowFrameLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  emptyCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xxl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
  },
  emptyActionButton: {
    marginTop: 6,
    minHeight: 48,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
