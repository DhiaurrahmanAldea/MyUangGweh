import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MonthHeader } from '../components/MonthHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import { SpendingDonutChart } from '../components/SpendingDonutChart';
import {
  useMonthSummary,
  useSelectedMonth,
  useSettings,
} from '../db/BudgetProvider';
import {
  assertNever,
  type BudgetStatus,
  type CurrencyCode,
  type MonthComparison,
} from '../types/domain';
import type { RootStackNavigationProp } from '../types/navigation';
import { formatMonthLabel, formatShortMonthLabel } from '../utils/date';
import { formatMoney } from '../utils/money';
import {
  RADIUS,
  SPACING,
  colorWithAlpha,
  useAppTheme,
  useResponsiveLayout,
  type AppTheme,
} from '../utils/theme';
import { useMainTabs } from './MainTabsContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface ComparisonPresentation {
  readonly icon: IoniconName;
  readonly iconColor: string;
  readonly iconBg: string;
  readonly headline: string;
  readonly headlineColor: string;
  readonly detail: string;
  readonly previousDisplay: string;
  readonly hasPreviousData: boolean;
}

function getComparisonPresentation(
  comparison: MonthComparison,
  currency: CurrencyCode,
  theme: AppTheme,
): ComparisonPresentation {
  const prevMonthLabel = formatShortMonthLabel(comparison.previousMonth);

  switch (comparison.kind) {
    case 'no-previous-data':
      return {
        icon: 'remove-outline',
        iconColor: theme.colors.textSecondary,
        iconBg: theme.colors.surfaceMuted,
        headline: `No spending in ${prevMonthLabel}`,
        headlineColor: theme.colors.text,
        detail: `No expense history in ${prevMonthLabel} to compare`,
        previousDisplay: 'No data',
        hasPreviousData: false,
      };
    case 'higher': {
      const detail =
        comparison.percentageChange !== null
          ? `Up ${comparison.percentageChange}% vs ${prevMonthLabel}`
          : `Compared to ${formatMoney(comparison.previousExpenses, currency)} in ${prevMonthLabel}`;
      return {
        icon: 'trending-up-outline',
        iconColor: theme.colors.negative,
        iconBg: theme.colors.negativeSoft,
        headline: `${formatMoney(comparison.difference, currency)} higher`,
        headlineColor: theme.colors.negative,
        detail,
        previousDisplay: formatMoney(comparison.previousExpenses, currency),
        hasPreviousData: true,
      };
    }
    case 'lower': {
      const detail =
        comparison.percentageChange !== null
          ? `Down ${comparison.percentageChange}% vs ${prevMonthLabel}`
          : `Lower than ${prevMonthLabel}`;
      return {
        icon: 'trending-down-outline',
        iconColor: theme.colors.positive,
        iconBg: theme.colors.positiveSoft,
        headline: `${formatMoney(comparison.difference, currency)} lower`,
        headlineColor: theme.colors.positive,
        detail,
        previousDisplay: formatMoney(comparison.previousExpenses, currency),
        hasPreviousData: true,
      };
    }
    case 'same':
      return {
        icon: 'remove-outline',
        iconColor: theme.colors.textSecondary,
        iconBg: theme.colors.surfaceMuted,
        headline: `Same as ${prevMonthLabel}`,
        headlineColor: theme.colors.text,
        detail: `0% change vs ${prevMonthLabel}`,
        previousDisplay: formatMoney(comparison.previousExpenses, currency),
        hasPreviousData: true,
      };
    default:
      return assertNever(comparison);
  }
}

interface BudgetIndicatorPresentation {
  readonly icon: IoniconName;
  readonly label: string;
  readonly textColor: string;
}

function getBudgetIndicator(
  status: BudgetStatus,
  currency: CurrencyCode,
  theme: AppTheme,
): BudgetIndicatorPresentation | null {
  switch (status.kind) {
    case 'unconfigured':
      return null;
    case 'ok':
      return {
        icon: 'checkmark-circle-outline',
        label: `${status.percent}% of ${formatMoney(status.limit, currency)} budget`,
        textColor: theme.colors.textSecondary,
      };
    case 'warning':
      return {
        icon: 'alert-circle-outline',
        label: `${status.percent}% of ${formatMoney(status.limit, currency)} budget`,
        textColor: theme.colors.warning,
      };
    case 'reached':
      return {
        icon: 'alert-circle-outline',
        label: `100% of ${formatMoney(status.limit, currency)} limit reached`,
        textColor: theme.colors.negative,
      };
    case 'exceeded':
      return {
        icon: 'warning-outline',
        label: `Over ${formatMoney(status.limit, currency)} budget by ${formatMoney(status.overage, currency)}`,
        textColor: theme.colors.negative,
      };
    default:
      return assertNever(status);
  }
}

export function ReportsScreen() {
  const theme = useAppTheme();
  const { horizontalPadding, isWide } = useResponsiveLayout();
  const navigation = useNavigation<RootStackNavigationProp>();
  const { switchTab } = useMainTabs();
  const settings = useSettings();
  const { selectedMonth, stepSelectedMonth, resetToCurrentMonth } =
    useSelectedMonth();
  const summary = useMonthSummary(selectedMonth);

  const comparison = getComparisonPresentation(
    summary.comparison,
    settings.currency,
    theme,
  );
  const selectedTotalDisplay = formatMoney(summary.expenses, settings.currency);
  const topCategoryItem = summary.expenseBreakdown[0];
  const totalExpenseTxCount = summary.expenseBreakdown.reduce(
    (sum, item) => sum + item.transactionCount,
    0,
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

      <ScrollView
        style={styles.scroll}
        nestedScrollEnabled={true}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontalPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenContainer style={styles.screenColumn}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.comparisonHeader}>
              <View
                style={[
                  styles.comparisonIconBadge,
                  { backgroundColor: comparison.iconBg },
                ]}
              >
                <Ionicons
                  name={comparison.icon}
                  size={20}
                  color={comparison.iconColor}
                />
              </View>
              <View style={styles.comparisonTextCol}>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Month-over-month
                </Text>
                <Text
                  style={[
                    theme.typography.sectionTitle,
                    styles.comparisonHeadline,
                    { color: comparison.headlineColor },
                  ]}
                >
                  {comparison.headline}
                </Text>
                <Text
                  style={[
                    theme.typography.caption,
                    styles.comparisonDetail,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {comparison.detail}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.comparisonFiguresRow,
                { borderTopColor: theme.colors.divider },
              ]}
            >
              <View style={styles.comparisonFigureCol}>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  Selected month
                </Text>
                <Text
                  style={[
                    theme.typography.sectionTitle,
                    styles.figureAmount,
                    { color: theme.colors.text },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {selectedTotalDisplay}
                </Text>
              </View>

              <View
                style={[
                  styles.figureDivider,
                  { backgroundColor: theme.colors.divider },
                ]}
              />

              <View style={styles.comparisonFigureCol}>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  Previous month
                </Text>
                <Text
                  style={[
                    theme.typography.sectionTitle,
                    styles.figureAmount,
                    {
                      color: comparison.hasPreviousData
                        ? theme.colors.text
                        : theme.colors.textMuted,
                    },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {comparison.previousDisplay}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.sectionTitleRow}>
              <Text
                style={[
                  theme.typography.sectionTitle,
                  { color: theme.colors.text },
                ]}
              >
                Spending by category
              </Text>
              {summary.expenseBreakdown.length > 0 ? (
                <Text
                  style={[
                    theme.typography.caption,
                    styles.categoryCountLabel,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {summary.expenseBreakdown.length === 1
                    ? '1 category'
                    : `${summary.expenseBreakdown.length} categories`}
                </Text>
              ) : null}
            </View>

            {isWide && topCategoryItem !== undefined ? (
              <View style={styles.wideChartRow}>
                <SpendingDonutChart
                  breakdown={summary.expenseBreakdown}
                  totalSpent={summary.expenses}
                  currency={settings.currency}
                />

                <View style={styles.wideSummaryPanel}>
                  <View style={styles.wideSummaryBlock}>
                    <Text
                      style={[
                        theme.typography.caption,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      Top category
                    </Text>
                    <View style={styles.wideTopCategoryRow}>
                      <View
                        style={[
                          styles.wideTopDot,
                          { backgroundColor: topCategoryItem.category.color },
                        ]}
                      />
                      <Text
                        style={[
                          theme.typography.bodyStrong,
                          styles.wideSummaryValue,
                          { color: theme.colors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {topCategoryItem.category.name}
                      </Text>
                    </View>
                    <Text
                      style={[
                        theme.typography.caption,
                        styles.wideSummarySubtext,
                        { color: theme.colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {`${formatMoney(topCategoryItem.total, settings.currency)} · ${topCategoryItem.percentage.toFixed(1)}%`}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.wideSummaryDivider,
                      { backgroundColor: theme.colors.divider },
                    ]}
                  />

                  <View style={styles.wideSummaryBlock}>
                    <Text
                      style={[
                        theme.typography.caption,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      Expense entries
                    </Text>
                    <Text
                      style={[
                        theme.typography.bodyStrong,
                        styles.wideSummaryValue,
                        { color: theme.colors.text },
                      ]}
                    >
                      {totalExpenseTxCount === 1
                        ? '1 transaction'
                        : `${totalExpenseTxCount} transactions`}
                    </Text>
                    <Text
                      style={[
                        theme.typography.micro,
                        styles.wideSummaryHint,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      Tap any category below to view transactions
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <SpendingDonutChart
                breakdown={summary.expenseBreakdown}
                totalSpent={summary.expenses}
                currency={settings.currency}
              />
            )}

            {summary.expenseBreakdown.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Text
                  style={[
                    theme.typography.bodyStrong,
                    styles.emptyTitle,
                    { color: theme.colors.text },
                  ]}
                >
                  {`No expenses in ${formatMonthLabel(selectedMonth)}`}
                </Text>
                <Text
                  style={[
                    theme.typography.caption,
                    styles.emptySubtitle,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Add an expense to see category shares and budget tracking for
                  this month.
                </Text>
                <Pressable
                  onPress={() =>
                    navigation.navigate('TransactionForm', {
                      mode: 'create',
                      initialType: 'expense',
                    })
                  }
                  android_ripple={{ color: theme.colors.ripple }}
                  style={({ pressed }) => [
                    styles.emptyButton,
                    {
                      backgroundColor:
                        Platform.OS !== 'android' && pressed
                          ? theme.colors.accentPressed
                          : theme.colors.accent,
                    },
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      theme.typography.bodyStrong,
                      { color: theme.colors.onAccent },
                    ]}
                  >
                    Add expense
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.breakdownList}>
                {summary.expenseBreakdown.map((item, index) => {
                  const iconBg = colorWithAlpha(
                    item.category.color,
                    theme.isDark ? 0.22 : 0.13,
                  );
                  const budgetIndicator = getBudgetIndicator(
                    item.budgetStatus,
                    settings.currency,
                    theme,
                  );
                  const countLabel =
                    item.transactionCount === 1
                      ? '1 transaction'
                      : `${item.transactionCount} transactions`;
                  const barWidthPercent = Math.max(
                    2,
                    Math.min(100, item.percentage),
                  );
                  const formattedAmount = formatMoney(
                    item.total,
                    settings.currency,
                  );

                  return (
                    <View key={item.category.id}>
                      <Pressable
                        onPress={() =>
                          switchTab('Transactions', {
                            filterType: 'expense',
                            categoryId: item.category.id,
                          })
                        }
                        android_ripple={{ color: theme.colors.ripple }}
                        style={({ pressed }) => [
                          styles.breakdownRow,
                          Platform.OS !== 'android' &&
                            pressed && {
                              backgroundColor: theme.colors.surfaceMuted,
                            },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.category.name}, ${formattedAmount}, ${item.percentage.toFixed(1)} percent, ${countLabel}`}
                      >
                        <View style={styles.breakdownTopRow}>
                          <View
                            style={[
                              styles.categoryBadge,
                              { backgroundColor: iconBg },
                            ]}
                          >
                            <Ionicons
                              name={item.category.icon}
                              size={18}
                              color={item.category.color}
                            />
                          </View>

                          <View style={styles.breakdownMeta}>
                            <Text
                              style={[
                                theme.typography.bodyStrong,
                                { color: theme.colors.text },
                              ]}
                              numberOfLines={1}
                            >
                              {item.category.name}
                            </Text>
                            <Text
                              style={[
                                theme.typography.caption,
                                { color: theme.colors.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {countLabel}
                            </Text>
                          </View>

                          <View style={styles.breakdownAmounts}>
                            <Text
                              style={[
                                theme.typography.bodyStrong,
                                styles.categoryAmount,
                                { color: theme.colors.text },
                              ]}
                              numberOfLines={1}
                            >
                              {formattedAmount}
                            </Text>
                            <Text
                              style={[
                                theme.typography.caption,
                                styles.sharePercent,
                                { color: theme.colors.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {`${item.percentage.toFixed(1)}%`}
                            </Text>
                          </View>

                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={theme.colors.textMuted}
                          />
                        </View>

                        <View
                          style={[
                            styles.shareTrack,
                            { backgroundColor: theme.colors.surfaceMuted },
                          ]}
                        >
                          <View
                            style={[
                              styles.shareFill,
                              {
                                backgroundColor: item.category.color,
                                width: `${barWidthPercent}%`,
                              },
                            ]}
                          />
                        </View>

                        {budgetIndicator !== null ? (
                          <View style={styles.budgetIndicatorRow}>
                            <Ionicons
                              name={budgetIndicator.icon}
                              size={13}
                              color={budgetIndicator.textColor}
                            />
                            <Text
                              style={[
                                theme.typography.caption,
                                styles.budgetIndicatorText,
                                { color: budgetIndicator.textColor },
                              ]}
                              numberOfLines={1}
                            >
                              {budgetIndicator.label}
                            </Text>
                          </View>
                        ) : null}
                      </Pressable>

                      {index < summary.expenseBreakdown.length - 1 ? (
                        <View
                          style={[
                            styles.rowDivider,
                            { backgroundColor: theme.colors.divider },
                          ]}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScreenContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SPACING.sm,
    paddingBottom: 32,
  },
  screenColumn: {
    gap: SPACING.lg,
  },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: 14,
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  comparisonIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonTextCol: {
    flex: 1,
    gap: 2,
  },
  comparisonHeadline: {
    fontVariant: ['tabular-nums'],
  },
  comparisonDetail: {
    fontVariant: ['tabular-nums'],
  },
  comparisonFiguresRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  comparisonFigureCol: {
    flex: 1,
    gap: SPACING.xs,
  },
  figureDivider: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: SPACING.md,
  },
  figureAmount: {
    fontSize: 17,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  categoryCountLabel: {
    fontVariant: ['tabular-nums'],
  },
  wideChartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xl,
  },
  wideSummaryPanel: {
    flex: 1,
    gap: SPACING.md,
  },
  wideSummaryBlock: {
    gap: 3,
  },
  wideTopCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  wideTopDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  wideSummaryValue: {
    fontWeight: '700',
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  wideSummarySubtext: {
    fontVariant: ['tabular-nums'],
  },
  wideSummaryDivider: {
    height: StyleSheet.hairlineWidth,
  },
  wideSummaryHint: {
    marginTop: 2,
  },
  emptyBlock: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
    paddingBottom: 6,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: SPACING.xs,
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownList: {
    marginHorizontal: -SPACING.lg,
    marginBottom: -SPACING.sm,
  },
  breakdownRow: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  breakdownTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  categoryBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownMeta: {
    flex: 1,
    gap: 2,
  },
  breakdownAmounts: {
    alignItems: 'flex-end',
    gap: 2,
    marginLeft: SPACING.xs,
  },
  categoryAmount: {
    fontVariant: ['tabular-nums'],
  },
  sharePercent: {
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  shareTrack: {
    height: 5,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  shareFill: {
    height: '100%',
    borderRadius: RADIUS.pill,
  },
  budgetIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  budgetIndicatorText: {
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
});
