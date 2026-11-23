import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import type {
  CategoryBreakdownItem,
  CategoryId,
  CurrencyCode,
  MinorUnits,
} from '../types/domain';
import { formatMoney } from '../utils/money';
import { useAppTheme, useResponsiveLayout } from '../utils/theme';

export interface SpendingDonutChartProps {
  readonly breakdown: readonly CategoryBreakdownItem[];
  readonly totalSpent: MinorUnits;
  readonly currency: CurrencyCode;
}

interface DonutSlice {
  readonly id: CategoryId;
  readonly color: string;
  readonly length: number;
  readonly offset: number;
}

const MIN_DIAMETER = 168;
const MAX_DIAMETER = 212;
const SLICE_GAP = 2;

export function SpendingDonutChart({
  breakdown,
  totalSpent,
  currency,
}: SpendingDonutChartProps) {
  const theme = useAppTheme();
  const { width, isCompact } = useResponsiveLayout();

  const strokeWidth = isCompact ? 22 : 26;
  const diameter = Math.round(
    Math.max(MIN_DIAMETER, Math.min(MAX_DIAMETER, width * 0.48)),
  );
  const center = diameter / 2;
  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const slices = useMemo<readonly DonutSlice[]>(() => {
    if (breakdown.length === 0) {
      return [];
    }
    let sliceTotal = 0;
    for (const item of breakdown) {
      sliceTotal += item.total;
    }
    if (sliceTotal <= 0) {
      return [];
    }

    const sliceGap = breakdown.length > 1 ? SLICE_GAP : 0;
    const result: DonutSlice[] = [];
    let accumulated = 0;
    for (let index = 0; index < breakdown.length; index += 1) {
      const item = breakdown[index];
      if (!item) {
        continue;
      }
      const isLast = index === breakdown.length - 1;
      const rawLength = isLast
        ? Math.max(0, circumference - accumulated)
        : (item.total / sliceTotal) * circumference;
      const drawLength = Math.max(0, rawLength - sliceGap);
      const offset = accumulated === 0 ? 0 : -accumulated;
      result.push({
        id: item.category.id,
        color: item.category.color,
        length: drawLength,
        offset,
      });
      accumulated += rawLength;
    }
    return result;
  }, [breakdown, circumference]);

  const hasExpenses = slices.length > 0;
  const formattedTotal = formatMoney(totalSpent, currency);

  return (
    <View
      style={[styles.wrapper, { paddingVertical: theme.spacing.xs }]}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={
        hasExpenses
          ? `Spending breakdown chart, total spent ${formattedTotal}`
          : 'Spending breakdown chart, no expenses'
      }
    >
      <View style={{ width: diameter, height: diameter }}>
        <Svg width={diameter} height={diameter}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={theme.colors.surfaceMuted}
            strokeWidth={strokeWidth}
          />
          {hasExpenses ? (
            <G transform={`rotate(-90 ${center} ${center})`}>
              {slices.map((slice) => (
                <Circle
                  key={slice.id}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={[slice.length, circumference]}
                  strokeDashoffset={slice.offset}
                  strokeLinecap="butt"
                />
              ))}
            </G>
          ) : null}
        </Svg>

        <View
          pointerEvents="none"
          style={[
            styles.centerOverlay,
            { paddingHorizontal: strokeWidth + 10 },
          ]}
        >
          {hasExpenses ? (
            <>
              <Text
                style={[
                  theme.typography.caption,
                  styles.centerLabel,
                  { color: theme.colors.textSecondary },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                Total spent
              </Text>
              <Text
                style={[
                  theme.typography.sectionTitle,
                  styles.centerAmount,
                  {
                    color: theme.colors.text,
                    fontSize: isCompact ? 17 : 19,
                    lineHeight: isCompact ? 22 : 24,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.55}
              >
                {formattedTotal}
              </Text>
            </>
          ) : (
            <Text
              style={[
                theme.typography.caption,
                styles.emptyLabel,
                { color: theme.colors.textMuted },
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              No expenses
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  centerLabel: {
    textAlign: 'center',
  },
  centerAmount: {
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  emptyLabel: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
