import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FloatingAddButton } from '../components/FloatingAddButton';
import { MonthHeader } from '../components/MonthHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import { SpentProgressBar } from '../components/SpentProgressBar';
import { SummaryCardRow } from '../components/SummaryCardRow';
import { TransactionRow } from '../components/TransactionRow';
import {
  useCategories,
  useMonthSummary,
  useSelectedMonth,
  useSettings,
} from '../db/BudgetProvider';
import {
  assertNever,
  type Category,
  type CategoryBreakdownItem,
  type CategoryId,
} from '../types/domain';
import type { RootStackNavigationProp } from '../types/navigation';
import { formatMonthLabel } from '../utils/date';
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

type AlertStatus = Extract<
  CategoryBreakdownItem['budgetStatus'],
  { readonly kind: 'warning' | 'reached' | 'exceeded' }
>;

interface BudgetAlertItem {
  readonly item: CategoryBreakdownItem;
  readonly status: AlertStatus;
}

function getAlertBadge(
  status: AlertStatus,
  theme: AppTheme,
): { readonly label: string; readonly color: string } {
  switch (status.kind) {
    case 'warning':
      return {
        label: `${status.percent}% used`,
        color: theme.colors.warning,
      };
    case 'reached':
      return {
        label: '100% reached',
        color: theme.colors.negative,
      };
    case 'exceeded':
      return {
        label: `${status.percent}% · Over`,
        color: theme.colors.negative,
      };
    default:
      return assertNever(status);
  }
}

export function DashboardScreen() {
  const theme = useAppTheme();
  const { horizontalPadding } = useResponsiveLayout();
  const navigation = useNavigation<RootStackNavigationProp>();
  const { switchTab } = useMainTabs();
  const settings = useSettings();
  const { selectedMonth, stepSelectedMonth, resetToCurrentMonth } =
    useSelectedMonth();
  const summary = useMonthSummary(selectedMonth);
  const categories = useCategories();

  const categoryById = useMemo(() => {
    const map = new Map<CategoryId, Category>();
    for (const category of categories) {
      map.set(category.id, category);
    }
    return map;
  }, [categories]);

  const budgetAlerts = useMemo<readonly BudgetAlertItem[]>(() => {
    const alerts: BudgetAlertItem[] = [];
    for (const item of summary.expenseBreakdown) {
      const status = item.budgetStatus;
      switch (status.kind) {
        case 'warning':
        case 'reached':
        case 'exceeded':
          alerts.push({ item, status });
          break;
        case 'unconfigured':
        case 'ok':
          break;
        default:
          assertNever(status);
      }
    }
    return alerts;
  }, [summary.expenseBreakdown]);

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
          <View style={styles.summaryCluster}>
            <SummaryCardRow
              summary={summary}
              currency={settings.currency}
              carryOverEnabled={settings.carryOverEnabled}
            />

            <SpentProgressBar
              progress={summary.spentProgress}
              income={summary.income}
              expenses={summary.expenses}
              currency={settings.currency}
            />
          </View>

          {budgetAlerts.length > 0 ? (
            <View style={styles.section}>
              <Text
                style={[
                  theme.typography.sectionTitle,
                  { color: theme.colors.text },
                ]}
              >
                Budget alerts
              </Text>

              <View
                style={[
                  styles.cardList,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                {budgetAlerts.map(({ item, status }, index) => {
                  const badge = getAlertBadge(status, theme);
                  const iconBg = colorWithAlpha(
                    item.category.color,
                    theme.isDark ? 0.22 : 0.13,
                  );
                  const subtext = `${formatMoney(status.spent, settings.currency)} of ${formatMoney(status.limit, settings.currency)}`;

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
                          styles.alertRow,
                          Platform.OS !== 'android' &&
                            pressed && {
                              backgroundColor: theme.colors.surfaceMuted,
                            },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.category.name}, ${subtext}, ${badge.label}`}
                      >
                        <View
                          style={[
                            styles.alertIconBadge,
                            { backgroundColor: iconBg },
                          ]}
                        >
                          <Ionicons
                            name={item.category.icon}
                            size={18}
                            color={item.category.color}
                          />
                        </View>

                        <View style={styles.alertTextCol}>
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
                              styles.alertSubtext,
                              { color: theme.colors.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {subtext}
                          </Text>
                        </View>

                        <Text
                          style={[
                            theme.typography.caption,
                            styles.alertStatusText,
                            { color: badge.color },
                          ]}
                          numberOfLines={1}
                        >
                          {badge.label}
                        </Text>
                      </Pressable>

                      {index < budgetAlerts.length - 1 ? (
                        <View
                          style={[
                            styles.divider,
                            { backgroundColor: theme.colors.divider },
                          ]}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text
                style={[
                  theme.typography.sectionTitle,
                  { color: theme.colors.text },
                ]}
              >
                Recent transactions
              </Text>
              <Pressable
                onPress={() => switchTab('Transactions')}
                android_ripple={{ color: theme.colors.ripple }}
                style={({ pressed }) => [
                  styles.seeAllButton,
                  Platform.OS !== 'android' && pressed && styles.seeAllPressed,
                ]}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="See all transactions"
              >
                <Text
                  style={[
                    theme.typography.caption,
                    styles.seeAllText,
                    { color: theme.colors.accent },
                  ]}
                >
                  See all
                </Text>
              </Pressable>
            </View>

            {summary.recentTransactions.length === 0 ? (
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
                    name="receipt-outline"
                    size={24}
                    color={theme.colors.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    theme.typography.bodyStrong,
                    styles.emptyTitle,
                    { color: theme.colors.text },
                  ]}
                >
                  {`No transactions in ${formatMonthLabel(selectedMonth)}`}
                </Text>
                <Text
                  style={[
                    theme.typography.caption,
                    styles.emptySubtitle,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Record an income or expense to start tracking this month.
                </Text>
                <Pressable
                  onPress={() =>
                    navigation.navigate('TransactionForm', { mode: 'create' })
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
                    Add transaction
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View
                style={[
                  styles.cardList,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                {summary.recentTransactions.map((transaction, index) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    category={categoryById.get(transaction.categoryId)}
                    currency={settings.currency}
                    showDate={true}
                    showDivider={index < summary.recentTransactions.length - 1}
                    onPress={(tx) =>
                      navigation.navigate('TransactionForm', {
                        mode: 'edit',
                        transactionId: tx.id,
                      })
                    }
                  />
                ))}
              </View>
            )}
          </View>
        </ScreenContainer>
      </ScrollView>

      <FloatingAddButton
        onPress={() =>
          navigation.navigate('TransactionForm', { mode: 'create' })
        }
      />
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
    paddingBottom: 104,
  },
  screenColumn: {
    gap: SPACING.xl,
  },
  summaryCluster: {
    gap: SPACING.md,
  },
  section: {
    gap: 10,
  },
  recentSection: {
    gap: SPACING.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAllButton: {
    minHeight: 48,
    minWidth: 48,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  seeAllPressed: {
    opacity: 0.7,
  },
  seeAllText: {
    fontWeight: '600',
  },
  cardList: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    minHeight: 56,
  },
  alertIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTextCol: {
    flex: 1,
    gap: 2,
  },
  alertSubtext: {
    fontVariant: ['tabular-nums'],
  },
  alertStatusText: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
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
  emptyButton: {
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
