import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CurrencyCode, MonthSummary } from '../types/domain';
import { formatMoney } from '../utils/money';
import { useAppTheme } from '../utils/theme';

export interface SummaryCardRowProps {
  readonly summary: MonthSummary;
  readonly currency: CurrencyCode;
  readonly carryOverEnabled: boolean;
}

export function SummaryCardRow({
  summary,
  currency,
  carryOverEnabled,
}: SummaryCardRowProps) {
  const theme = useAppTheme();

  const balance = summary.effectiveBalance;
  const isNegative = balance < 0;
  const isPositive = balance > 0;

  const balanceColor = isNegative
    ? theme.colors.negative
    : isPositive
      ? theme.colors.positive
      : theme.colors.text;

  const statusLabel = isNegative
    ? 'Deficit'
    : isPositive
      ? 'Surplus'
      : 'Balanced';

  const formattedBalance = formatMoney(balance, currency);
  const formattedIncome = formatMoney(summary.income, currency);
  const formattedExpenses = formatMoney(summary.expenses, currency);
  const hasCarryOver = carryOverEnabled && summary.carryOverFromPrevious !== 0;
  const formattedCarryOver = hasCarryOver
    ? formatMoney(summary.carryOverFromPrevious, currency)
    : '';

  const primaryAccessibilityLabel = hasCarryOver
    ? `Remaining balance, ${formattedBalance}, ${statusLabel}, includes ${formattedCarryOver} carry-over`
    : `Remaining balance, ${formattedBalance}, ${statusLabel}`;

  return (
    <View
      style={[
        styles.surfaceCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.xl,
        },
      ]}
    >
      <View
        accessible={true}
        accessibilityLabel={primaryAccessibilityLabel}
        style={styles.topBlock}
      >
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          Remaining balance
        </Text>

        <Text
          style={[
            theme.typography.display,
            styles.balanceAmount,
            { color: balanceColor },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.62}
        >
          {formattedBalance}
        </Text>

        {hasCarryOver ? (
          <Text
            style={[
              theme.typography.caption,
              styles.carryOverText,
              { color: theme.colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            {`Includes ${formattedCarryOver} carry-over`}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.horizontalDivider,
          { backgroundColor: theme.colors.divider },
        ]}
      />

      <View style={styles.metricsRow}>
        <View
          accessible={true}
          accessibilityLabel={`Total income, ${formattedIncome}`}
          style={[styles.metricCol, styles.leftMetricCol]}
        >
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            Income
          </Text>
          <Text
            style={[
              styles.metricAmount,
              {
                color:
                  summary.income > 0
                    ? theme.colors.positive
                    : theme.colors.text,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {formattedIncome}
          </Text>
        </View>

        <View
          style={[
            styles.verticalDivider,
            { backgroundColor: theme.colors.divider },
          ]}
        />

        <View
          accessible={true}
          accessibilityLabel={`Total expenses, ${formattedExpenses}`}
          style={[styles.metricCol, styles.rightMetricCol]}
        >
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            Expenses
          </Text>
          <Text
            style={[styles.metricAmount, { color: theme.colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {formattedExpenses}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  surfaceCard: {
    borderWidth: 1,
    gap: 16,
  },
  topBlock: {
    gap: 4,
  },
  balanceAmount: {
    fontVariant: ['tabular-nums'],
  },
  carryOverText: {
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  horizontalDivider: {
    height: StyleSheet.hairlineWidth,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  metricCol: {
    flex: 1,
    gap: 4,
  },
  leftMetricCol: {
    paddingRight: 16,
  },
  rightMetricCol: {
    paddingLeft: 16,
  },
  verticalDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  metricAmount: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.25,
    fontVariant: ['tabular-nums'],
  },
});
