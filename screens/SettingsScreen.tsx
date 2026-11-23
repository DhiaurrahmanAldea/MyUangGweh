import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecurringRuleModal } from '../components/RecurringRuleModal';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  SegmentedControl,
  type SegmentedOption,
} from '../components/SegmentedControl';
import {
  useBudgetStore,
  useCategories,
  useRecurringRules,
  useSelectedMonth,
  useSettings,
  useTransactionCount,
} from '../db/BudgetProvider';
import type { RecurringRuleDraft } from '../db/store';
import {
  CURRENCIES,
  CURRENCY_CODES,
  toComputedMinorUnits,
  type Category,
  type CategoryId,
  type CurrencyCode,
  type RecurringRule,
  type ThemePreference,
} from '../types/domain';
import type { RootStackScreenProps } from '../types/navigation';
import { serializeTransactionsToCsv } from '../utils/csv';
import { currentYearMonth, todayIsoDate } from '../utils/date';
import { formatMoney } from '../utils/money';
import { clearAllReceiptImagesQuietly } from '../utils/receipt';
import {
  RADIUS,
  SPACING,
  colorWithAlpha,
  useAppTheme,
  useResponsiveLayout,
} from '../utils/theme';

const THEME_OPTIONS: readonly SegmentedOption<ThemePreference>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const EXAMPLE_ZERO_DECIMAL_UNITS = toComputedMinorUnits(1_500_000);
const EXAMPLE_TWO_DECIMAL_UNITS = toComputedMinorUnits(150_000);

export function SettingsScreen(_props: RootStackScreenProps<'Settings'>) {
  const theme = useAppTheme();
  const { horizontalPadding } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const store = useBudgetStore();
  const settings = useSettings();
  const { selectedMonth } = useSelectedMonth();
  const allCategories = useCategories();
  const transactionCount = useTransactionCount();
  const recurringRules = useRecurringRules();

  const [isExporting, setIsExporting] = useState(false);
  const [ruleModalVisible, setRuleModalVisible] = useState(false);

  const categoryById = useMemo(() => {
    const map = new Map<CategoryId, Category>();
    for (const category of allCategories) {
      map.set(category.id, category);
    }
    return map;
  }, [allCategories]);

  const handleSelectCurrency = useCallback(
    (nextCurrency: CurrencyCode) => {
      if (nextCurrency === settings.currency) {
        return;
      }
      const currentDecimals = CURRENCIES[settings.currency].decimals;
      const nextDecimals = CURRENCIES[nextCurrency].decimals;
      if (currentDecimals !== nextDecimals) {
        Alert.alert(
          `Switch currency to ${nextCurrency}?`,
          'Stored transaction amounts are not FX-converted when changing between 0-decimal and 2-decimal currencies.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Switch',
              onPress: () => store.updateSettings({ currency: nextCurrency }),
            },
          ],
        );
        return;
      }
      store.updateSettings({ currency: nextCurrency });
    },
    [settings.currency, store],
  );

  const handleToggleCarryOver = useCallback(
    (value: boolean) => {
      store.updateSettings({ carryOverEnabled: value });
    },
    [store],
  );

  const handleSelectTheme = useCallback(
    (preference: ThemePreference) => {
      store.updateSettings({ theme: preference });
    },
    [store],
  );

  const openAddRuleModal = useCallback(() => {
    setRuleModalVisible(true);
  }, []);

  const closeAddRuleModal = useCallback(() => {
    setRuleModalVisible(false);
  }, []);

  const handleSaveRecurringRule = useCallback(
    (draft: RecurringRuleDraft) => {
      store.saveRecurringRule(draft);
      const todayMonth = currentYearMonth();
      store.materializeRecurringThrough(
        selectedMonth <= todayMonth ? selectedMonth : todayMonth,
      );
      setRuleModalVisible(false);
    },
    [selectedMonth, store],
  );

  const handleToggleRuleActive = useCallback(
    (rule: RecurringRule, nextActive: boolean) => {
      store.saveRecurringRule({
        id: rule.id,
        type: rule.type,
        amount: rule.amount,
        categoryId: rule.categoryId,
        dayOfMonth: rule.dayOfMonth,
        note: rule.note,
        startMonth: rule.startMonth,
        isActive: nextActive,
      });
      if (nextActive) {
        const todayMonth = currentYearMonth();
        store.materializeRecurringThrough(
          selectedMonth <= todayMonth ? selectedMonth : todayMonth,
        );
      }
    },
    [selectedMonth, store],
  );

  const handleDeleteRule = useCallback(
    (rule: RecurringRule) => {
      const categoryName = categoryById.get(rule.categoryId)?.name ?? 'Other';
      Alert.alert(
        'Delete recurring rule?',
        `Stop generating monthly "${categoryName}" transactions. Existing transactions are kept.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              store.deleteRecurringRule(rule.id);
            },
          },
        ],
      );
    },
    [categoryById, store],
  );

  const handleExportCsv = useCallback(async () => {
    if (isExporting) {
      return;
    }
    const transactions = store.getAllTransactions();
    if (transactions.length === 0) {
      Alert.alert(
        'No transactions to export',
        'Add at least one transaction before exporting to CSV.',
      );
      return;
    }

    setIsExporting(true);
    try {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        Alert.alert(
          'Sharing unavailable',
          'File sharing is not supported on this device.',
        );
        return;
      }

      const categories = store.getCategories();
      const csv = serializeTransactionsToCsv(
        transactions,
        categories,
        settings.currency,
      );
      const filename = `myuanggweh-${todayIsoDate()}.csv`;
      const file = new File(Paths.cache, filename);
      file.create({ overwrite: true });
      await file.write(csv);
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export transactions',
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to write or share the CSV export.';
      Alert.alert('Export failed', message);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, settings.currency, store]);

  const handleResetDevSeed = useCallback(() => {
    Alert.alert(
      'Reset sample data?',
      'This deletes all current transactions, custom categories, recurring rules, and settings, then restores the dev sample data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            store.resetDevSeed();
            clearAllReceiptImagesQuietly();
          },
        },
      ],
    );
  }, [store]);

  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

  return (
    <>
      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.canvas }]}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: Math.max(insets.bottom, SPACING.xxl) + SPACING.md,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenContainer style={styles.sectionsColumn}>
          <View style={styles.section}>
            <Text
              style={[
                theme.typography.sectionTitle,
                { color: theme.colors.text },
              ]}
            >
              Currency
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {CURRENCY_CODES.map((code, index) => {
                const config = CURRENCIES[code];
                const isSelected = settings.currency === code;
                const exampleUnits =
                  config.decimals === 0
                    ? EXAMPLE_ZERO_DECIMAL_UNITS
                    : EXAMPLE_TWO_DECIMAL_UNITS;
                const example = formatMoney(exampleUnits, code);

                return (
                  <View key={code}>
                    <Pressable
                      onPress={() => handleSelectCurrency(code)}
                      android_ripple={{ color: theme.colors.ripple }}
                      style={({ pressed }) => [
                        styles.currencyRow,
                        Platform.OS !== 'android' &&
                          pressed && {
                            backgroundColor: theme.colors.surfaceMuted,
                          },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${config.code}, ${config.label}, example ${example}`}
                    >
                      <View style={styles.currencyMeta}>
                        <View style={styles.currencyTitleRow}>
                          <Text
                            style={[
                              theme.typography.bodyStrong,
                              styles.currencyCode,
                              { color: theme.colors.text },
                            ]}
                          >
                            {config.code}
                          </Text>
                          <Text
                            style={[
                              theme.typography.body,
                              styles.currencyLabel,
                              { color: theme.colors.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {config.label}
                          </Text>
                        </View>
                        <Text
                          style={[
                            theme.typography.caption,
                            styles.currencyExample,
                            { color: theme.colors.textMuted },
                          ]}
                        >
                          {example}
                        </Text>
                      </View>

                      {isSelected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={theme.colors.accent}
                        />
                      ) : (
                        <View
                          style={[
                            styles.radioOuter,
                            { borderColor: theme.colors.border },
                          ]}
                        />
                      )}
                    </Pressable>
                    {index < CURRENCY_CODES.length - 1 ? (
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
          </View>

          <View style={styles.section}>
            <Text
              style={[
                theme.typography.sectionTitle,
                { color: theme.colors.text },
              ]}
            >
              Budgeting
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.switchRow}>
                <View style={styles.switchTextCol}>
                  <Text
                    style={[
                      theme.typography.bodyStrong,
                      { color: theme.colors.text },
                    ]}
                  >
                    Carry over remaining balance
                  </Text>
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Add prior months&apos; net balance to the selected
                    month&apos;s remaining balance.
                  </Text>
                </View>
                <Switch
                  value={settings.carryOverEnabled}
                  onValueChange={handleToggleCarryOver}
                  trackColor={{
                    false: theme.colors.border,
                    true: theme.colors.accent,
                  }}
                  thumbColor={theme.colors.switchThumb}
                  accessibilityLabel="Carry over remaining balance"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text
              style={[
                theme.typography.sectionTitle,
                { color: theme.colors.text },
              ]}
            >
              Appearance
            </Text>
            <SegmentedControl
              value={settings.theme}
              onChange={handleSelectTheme}
              options={THEME_OPTIONS}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[
                  theme.typography.sectionTitle,
                  { color: theme.colors.text },
                ]}
              >
                Recurring transactions
              </Text>
              <Pressable
                onPress={openAddRuleModal}
                android_ripple={{ color: theme.colors.ripple }}
                style={({ pressed }) => [
                  styles.addRuleButton,
                  {
                    backgroundColor:
                      Platform.OS !== 'android' && pressed
                        ? theme.colors.surfaceMuted
                        : theme.colors.accentSoft,
                  },
                ]}
                accessibilityRole="button"
              >
                <Ionicons
                  name="add-outline"
                  size={16}
                  color={theme.colors.accent}
                />
                <Text
                  style={[
                    theme.typography.caption,
                    styles.addRuleText,
                    { color: theme.colors.accent },
                  ]}
                >
                  Add recurring
                </Text>
              </Pressable>
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
              {recurringRules.length === 0 ? (
                <View style={styles.emptyRuleBox}>
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    No recurring transactions configured. Add monthly rent,
                    subscriptions, or salary.
                  </Text>
                </View>
              ) : (
                recurringRules.map((rule, index) => {
                  const category = categoryById.get(rule.categoryId);
                  const categoryName = category?.name ?? 'Other';
                  const categoryIcon =
                    category?.icon ?? 'ellipsis-horizontal-circle-outline';
                  const categoryColor =
                    category?.color ?? theme.colors.textMuted;
                  const badgeBg = colorWithAlpha(
                    categoryColor,
                    theme.isDark ? 0.22 : 0.13,
                  );
                  const formattedAmount =
                    rule.type === 'income'
                      ? formatMoney(rule.amount, settings.currency, {
                          showSign: true,
                        })
                      : `-${formatMoney(rule.amount, settings.currency)}`;
                  const amountColor =
                    rule.type === 'income'
                      ? theme.colors.positive
                      : theme.colors.text;
                  const titleText =
                    rule.note.trim().length > 0
                      ? `${categoryName} · ${rule.note.trim()}`
                      : categoryName;

                  return (
                    <View key={rule.id}>
                      <View style={styles.ruleRow}>
                        <View
                          style={[
                            styles.ruleIconBadge,
                            { backgroundColor: badgeBg },
                          ]}
                        >
                          <Ionicons
                            name={categoryIcon}
                            size={18}
                            color={categoryColor}
                          />
                        </View>

                        <View style={styles.ruleMetaCol}>
                          <Text
                            style={[
                              theme.typography.bodyStrong,
                              {
                                color: rule.isActive
                                  ? theme.colors.text
                                  : theme.colors.textMuted,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {titleText}
                          </Text>
                          <Text
                            style={[
                              theme.typography.caption,
                              { color: theme.colors.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {`Day ${rule.dayOfMonth} · Monthly`}
                          </Text>
                          <Text
                            style={[
                              theme.typography.bodyStrong,
                              styles.ruleAmount,
                              {
                                color: rule.isActive
                                  ? amountColor
                                  : theme.colors.textMuted,
                              },
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.75}
                          >
                            {formattedAmount}
                          </Text>
                        </View>

                        <View style={styles.ruleControls}>
                          <Switch
                            value={rule.isActive}
                            onValueChange={(nextValue) =>
                              handleToggleRuleActive(rule, nextValue)
                            }
                            trackColor={{
                              false: theme.colors.border,
                              true: theme.colors.accent,
                            }}
                            thumbColor={theme.colors.switchThumb}
                            accessibilityLabel={`Toggle ${titleText} recurring rule`}
                          />
                          <Pressable
                            onPress={() => handleDeleteRule(rule)}
                            android_ripple={{
                              color: theme.colors.ripple,
                              borderless: true,
                              radius: 24,
                            }}
                            style={({ pressed }) => [
                              styles.ruleDeleteButton,
                              Platform.OS !== 'android' &&
                                pressed && {
                                  backgroundColor: theme.colors.negativeSoft,
                                },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${titleText} recurring rule`}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={18}
                              color={theme.colors.negative}
                            />
                          </Pressable>
                        </View>
                      </View>

                      {index < recurringRules.length - 1 ? (
                        <View
                          style={[
                            styles.rowDivider,
                            styles.ruleRowDivider,
                            { backgroundColor: theme.colors.divider },
                          ]}
                        />
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text
              style={[
                theme.typography.sectionTitle,
                { color: theme.colors.text },
              ]}
            >
              Data and export
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Pressable
                onPress={handleExportCsv}
                disabled={isExporting}
                android_ripple={{ color: theme.colors.ripple }}
                style={({ pressed }) => [
                  styles.actionRow,
                  isExporting && styles.actionRowExporting,
                  Platform.OS !== 'android' &&
                    pressed && { backgroundColor: theme.colors.surfaceMuted },
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: isExporting, busy: isExporting }}
                accessibilityLabel="Export transactions as CSV"
              >
                <View
                  style={[
                    styles.actionIconBadge,
                    { backgroundColor: theme.colors.accentSoft },
                  ]}
                >
                  <Ionicons
                    name="download-outline"
                    size={19}
                    color={theme.colors.accent}
                  />
                </View>
                <View style={styles.actionTextCol}>
                  <Text
                    style={[
                      theme.typography.bodyStrong,
                      { color: theme.colors.text },
                    ]}
                  >
                    {isExporting ? 'Preparing CSV…' : 'Export CSV'}
                  </Text>
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    {transactionCount === 1
                      ? 'Share 1 transaction as a spreadsheet file'
                      : `Share ${transactionCount} transactions as a spreadsheet file`}
                  </Text>
                </View>
                {isExporting ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.accent}
                  />
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={theme.colors.textMuted}
                  />
                )}
              </Pressable>

              {isDev ? (
                <>
                  <View
                    style={[
                      styles.rowDivider,
                      styles.actionRowDivider,
                      { backgroundColor: theme.colors.divider },
                    ]}
                  />
                  <Pressable
                    onPress={handleResetDevSeed}
                    android_ripple={{ color: theme.colors.ripple }}
                    style={({ pressed }) => [
                      styles.actionRow,
                      Platform.OS !== 'android' &&
                        pressed && {
                          backgroundColor: theme.colors.negativeSoft,
                        },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Reset sample data"
                  >
                    <View
                      style={[
                        styles.actionIconBadge,
                        { backgroundColor: theme.colors.negativeSoft },
                      ]}
                    >
                      <Ionicons
                        name="refresh-outline"
                        size={19}
                        color={theme.colors.negative}
                      />
                    </View>
                    <View style={styles.actionTextCol}>
                      <Text
                        style={[
                          theme.typography.bodyStrong,
                          { color: theme.colors.negative },
                        ]}
                      >
                        Reset sample data
                      </Text>
                      <Text
                        style={[
                          theme.typography.caption,
                          { color: theme.colors.textSecondary },
                        ]}
                      >
                        Restore default categories and two months of sample
                        entries
                      </Text>
                    </View>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
        </ScreenContainer>
      </ScrollView>

      <RecurringRuleModal
        visible={ruleModalVisible}
        currency={settings.currency}
        categories={allCategories}
        defaultStartMonth={selectedMonth}
        onClose={closeAddRuleModal}
        onSave={handleSaveRecurringRule}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 14,
  },
  sectionsColumn: {
    gap: SPACING.xl,
  },
  section: {
    gap: SPACING.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    minHeight: 58,
  },
  currencyMeta: {
    flex: 1,
    gap: 2,
  },
  currencyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  currencyCode: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  currencyLabel: {
    flexShrink: 1,
  },
  currencyExample: {
    fontVariant: ['tabular-nums'],
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 14,
  },
  ruleRowDivider: {
    marginLeft: 62,
  },
  actionRowDivider: {
    marginLeft: 64,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: SPACING.md,
  },
  switchTextCol: {
    flex: 1,
    gap: 3,
  },
  addRuleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  addRuleText: {
    fontWeight: '600',
  },
  emptyRuleBox: {
    padding: SPACING.lg,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: SPACING.md,
    gap: 10,
  },
  ruleIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleMetaCol: {
    flex: 1,
    gap: 2,
  },
  ruleAmount: {
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  ruleControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  ruleDeleteButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: SPACING.md,
  },
  actionRowExporting: {
    opacity: 0.65,
  },
  actionIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextCol: {
    flex: 1,
    gap: 2,
  },
});
