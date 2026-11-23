import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { YearMonth } from '../types/domain';
import { currentYearMonth, formatMonthLabel } from '../utils/date';
import { useAppTheme, useResponsiveLayout } from '../utils/theme';
import { ScreenContainer } from './ScreenContainer';

export interface MonthHeaderProps {
  readonly month: YearMonth;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onResetToday?: () => void;
  readonly onOpenSettings: () => void;
}

export function MonthHeader({
  month,
  onPrev,
  onNext,
  onResetToday,
  onOpenSettings,
}: MonthHeaderProps) {
  const theme = useAppTheme();
  const { horizontalPadding } = useResponsiveLayout();
  const isCurrentMonth = month === currentYearMonth();
  const canReset = !isCurrentMonth && onResetToday !== undefined;
  const label = formatMonthLabel(month);

  return (
    <ScreenContainer
      style={[
        styles.container,
        {
          paddingHorizontal: Math.max(
            theme.spacing.md,
            horizontalPadding - theme.spacing.sm,
          ),
        },
      ]}
    >
      <View style={styles.sideSpacer} />

      <View style={styles.monthControls}>
        <Pressable
          onPress={onPrev}
          android_ripple={{
            color: theme.colors.ripple,
            borderless: true,
            radius: 24,
          }}
          style={({ pressed }) => [
            styles.iconButton,
            Platform.OS !== 'android' &&
              pressed && { backgroundColor: theme.colors.surfaceMuted },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>

        <Pressable
          onPress={canReset ? onResetToday : undefined}
          disabled={!canReset}
          android_ripple={canReset ? { color: theme.colors.ripple } : undefined}
          style={({ pressed }) => [
            styles.monthLabelButton,
            {
              borderRadius: theme.radius.pill,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
            },
            canReset && {
              backgroundColor:
                Platform.OS !== 'android' && pressed
                  ? theme.colors.surfaceMuted
                  : theme.colors.accentSoft,
            },
          ]}
          accessibilityRole={canReset ? 'button' : 'header'}
          accessibilityLabel={
            canReset ? `${label}, return to current month` : label
          }
          accessibilityHint={
            canReset ? 'Jumps back to the current month' : undefined
          }
        >
          {canReset ? (
            <Ionicons
              name="today-outline"
              size={15}
              color={theme.colors.accent}
            />
          ) : null}
          <Text
            style={[
              theme.typography.sectionTitle,
              styles.monthLabel,
              { color: canReset ? theme.colors.accent : theme.colors.text },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            {label}
          </Text>
        </Pressable>

        <Pressable
          onPress={onNext}
          android_ripple={{
            color: theme.colors.ripple,
            borderless: true,
            radius: 24,
          }}
          style={({ pressed }) => [
            styles.iconButton,
            Platform.OS !== 'android' &&
              pressed && { backgroundColor: theme.colors.surfaceMuted },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.colors.text}
          />
        </Pressable>
      </View>

      <Pressable
        onPress={onOpenSettings}
        android_ripple={{
          color: theme.colors.ripple,
          borderless: true,
          radius: 24,
        }}
        style={({ pressed }) => [
          styles.iconButton,
          Platform.OS !== 'android' &&
            pressed && { backgroundColor: theme.colors.surfaceMuted },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <Ionicons
          name="settings-outline"
          size={20}
          color={theme.colors.text}
        />
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    minHeight: 56,
  },
  sideSpacer: {
    width: 48,
    height: 48,
  },
  monthControls: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 0,
    minWidth: 48,
    minHeight: 48,
    maxWidth: 210,
    overflow: 'hidden',
  },
  monthLabel: {
    flexShrink: 1,
  },
});
