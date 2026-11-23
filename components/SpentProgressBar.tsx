import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import {
  assertNever,
  type CurrencyCode,
  type MinorUnits,
  type SpentProgress,
} from '../types/domain';
import { formatMoney } from '../utils/money';
import { useAppTheme, useReduceMotion, type AppTheme } from '../utils/theme';

export interface SpentProgressBarProps {
  readonly progress: SpentProgress;
  readonly income?: MinorUnits;
  readonly expenses?: MinorUnits;
  readonly currency?: CurrencyCode;
}

interface ProgressPresentation {
  readonly label: string;
  readonly textColor: string;
  readonly trackColor: string;
  readonly fillColor: string;
  readonly fillPercent: number;
  readonly accessibilityNow: number;
}

function getProgressPresentation(
  progress: SpentProgress,
  theme: AppTheme,
): ProgressPresentation {
  switch (progress.kind) {
    case 'no-income':
      return {
        label: 'No income recorded',
        textColor: progress.hasExpenses
          ? theme.colors.warning
          : theme.colors.textSecondary,
        trackColor: progress.hasExpenses
          ? theme.colors.warningSoft
          : theme.colors.surfaceMuted,
        fillColor: progress.hasExpenses
          ? theme.colors.warning
          : theme.colors.surfaceMuted,
        fillPercent: 0,
        accessibilityNow: 0,
      };
    case 'within-budget': {
      const isWarning = progress.percent >= 80;
      const fillPercent = Math.max(0, Math.min(100, progress.ratio * 100));
      return {
        label: `${progress.percent}% of income spent`,
        textColor: isWarning ? theme.colors.warning : theme.colors.accent,
        trackColor: theme.colors.surfaceMuted,
        fillColor: isWarning ? theme.colors.warning : theme.colors.accent,
        fillPercent,
        accessibilityNow: Math.max(0, Math.min(100, Math.round(progress.percent))),
      };
    }
    case 'over-budget':
      return {
        label: `${progress.percent}% of income spent · Over income`,
        textColor: theme.colors.negative,
        trackColor: theme.colors.negativeSoft,
        fillColor: theme.colors.negative,
        fillPercent: 100,
        accessibilityNow: 100,
      };
    default:
      return assertNever(progress);
  }
}

export function SpentProgressBar({
  progress,
  income,
  expenses,
  currency,
}: SpentProgressBarProps) {
  const theme = useAppTheme();
  const reduceMotion = useReduceMotion();
  const view = getProgressPresentation(progress, theme);
  const animatedPercent = useRef(new Animated.Value(view.fillPercent)).current;

  useEffect(() => {
    if (reduceMotion) {
      animatedPercent.setValue(view.fillPercent);
      return;
    }

    const animation = Animated.timing(animatedPercent, {
      toValue: view.fillPercent,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();

    return () => {
      animation.stop();
    };
  }, [animatedPercent, reduceMotion, view.fillPercent]);

  const animatedWidth = animatedPercent.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const showThresholdMarker = progress.kind !== 'no-income';
  const showComparisonCaption =
    income !== undefined &&
    expenses !== undefined &&
    currency !== undefined &&
    income > 0;
  const comparisonText = showComparisonCaption
    ? `${formatMoney(expenses, currency)} of ${formatMoney(income, currency)}`
    : null;

  return (
    <View
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel={
        comparisonText !== null
          ? `Income spent, ${view.label}, ${comparisonText}`
          : `Income spent, ${view.label}`
      }
      accessibilityValue={{
        min: 0,
        max: 100,
        now: view.accessibilityNow,
        text: view.label,
      }}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: 14,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textSecondary },
          ]}
        >
          Income spent
        </Text>
        <Text
          style={[
            theme.typography.caption,
            styles.statusText,
            { color: view.textColor },
          ]}
          numberOfLines={1}
        >
          {view.label}
        </Text>
      </View>

      <View
        style={[
          styles.track,
          {
            backgroundColor: view.trackColor,
            borderRadius: theme.radius.pill,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: view.fillColor,
              borderRadius: theme.radius.pill,
              width: animatedWidth,
            },
          ]}
        />
        {showThresholdMarker ? (
          <View
            pointerEvents="none"
            style={[
              styles.thresholdMarker,
              { backgroundColor: theme.colors.surface },
            ]}
          />
        ) : null}
      </View>

      {comparisonText !== null ? (
        <Text
          style={[
            theme.typography.caption,
            styles.captionAmount,
            { color: theme.colors.textSecondary },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {comparisonText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusText: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  track: {
    position: 'relative',
    height: 6,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  thresholdMarker: {
    position: 'absolute',
    left: '80%',
    top: 0,
    bottom: 0,
    width: 1,
  },
  captionAmount: {
    fontVariant: ['tabular-nums'],
  },
});
