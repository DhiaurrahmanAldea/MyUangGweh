import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { IsoDate, YearMonth } from '../types/domain';
import {
  CALENDAR_WEEKDAY_LABELS,
  buildMonthCalendarGrid,
  currentYearMonth,
  formatFullDateLabel,
  formatMonthLabel,
  isoDateToYearMonth,
  stepYearMonth,
  todayIsoDate,
} from '../utils/date';
import {
  RADIUS,
  SPACING,
  useAppTheme,
  useReduceMotion,
} from '../utils/theme';

export interface CalendarDropdownProps {
  readonly visible: boolean;
  readonly selectedDate: IsoDate;
  readonly onSelectDate: (date: IsoDate) => void;
}

export function CalendarDropdown({
  visible,
  selectedDate,
  onSelectDate,
}: CalendarDropdownProps) {
  const theme = useAppTheme();
  const reduceMotion = useReduceMotion();
  const [viewMonth, setViewMonth] = useState<YearMonth>(() =>
    isoDateToYearMonth(selectedDate),
  );

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-6)).current;

  useEffect(() => {
    if (visible) {
      setViewMonth(isoDateToYearMonth(selectedDate));
    }
  }, [visible, selectedDate]);

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      translateY.setValue(reduceMotion ? 0 : -6);
      return;
    }

    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(-6);
    const entrance = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    entrance.start();

    return () => {
      entrance.stop();
    };
  }, [visible, reduceMotion, opacity, translateY]);

  const cells = useMemo(() => buildMonthCalendarGrid(viewMonth), [viewMonth]);
  const today = todayIsoDate();
  const activeMonth = currentYearMonth();
  const showTodayJump = viewMonth !== activeMonth;

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.canvas,
          borderColor: theme.colors.border,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => setViewMonth((prev) => stepYearMonth(prev, -1))}
          style={({ pressed }) => [
            styles.navButton,
            pressed && { backgroundColor: theme.colors.surfaceMuted },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text
            style={[
              theme.typography.cardTitle,
              styles.monthLabel,
              { color: theme.colors.text },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {formatMonthLabel(viewMonth)}
          </Text>

          {showTodayJump ? (
            <Pressable
              onPress={() => setViewMonth(activeMonth)}
              style={({ pressed }) => [
                styles.todayPill,
                {
                  backgroundColor: pressed
                    ? theme.colors.surfaceMuted
                    : theme.colors.accentSoft,
                },
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Jump to current month"
            >
              <Text
                style={[
                  theme.typography.micro,
                  styles.todayPillText,
                  { color: theme.colors.accent },
                ]}
              >
                Today
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => setViewMonth((prev) => stepYearMonth(prev, 1))}
          style={({ pressed }) => [
            styles.navButton,
            pressed && { backgroundColor: theme.colors.surfaceMuted },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.colors.text}
          />
        </Pressable>
      </View>

      <View
        style={[
          styles.weekdayRow,
          { borderBottomColor: theme.colors.divider },
        ]}
      >
        {CALENDAR_WEEKDAY_LABELS.map((label) => (
          <View key={label} style={styles.weekdayCell}>
            <Text
              style={[
                theme.typography.micro,
                { color: theme.colors.textMuted },
              ]}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((dayIso, index) => {
          if (dayIso === null) {
            return <View key={`empty_${index}`} style={styles.dayCell} />;
          }

          const isSelected = dayIso === selectedDate;
          const isToday = dayIso === today;
          const dayNumber = String(Number(dayIso.slice(8, 10)));

          return (
            <Pressable
              key={dayIso}
              onPress={() => onSelectDate(dayIso)}
              style={styles.dayCell}
              hitSlop={{ top: 2, bottom: 2, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={
                isToday
                  ? `${formatFullDateLabel(dayIso)}, Today`
                  : formatFullDateLabel(dayIso)
              }
              accessibilityState={{ selected: isSelected }}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.dayCircle,
                    isSelected
                      ? { backgroundColor: theme.colors.accent }
                      : isToday
                        ? {
                            borderWidth: 1.5,
                            borderColor: theme.colors.accent,
                            backgroundColor: pressed
                              ? theme.colors.accentSoft
                              : 'transparent',
                          }
                        : pressed
                          ? { backgroundColor: theme.colors.surfaceMuted }
                          : undefined,
                  ]}
                >
                  <Text
                    style={[
                      theme.typography.caption,
                      styles.dayText,
                      {
                        color: isSelected
                          ? theme.colors.onAccent
                          : isToday
                            ? theme.colors.accent
                            : theme.colors.text,
                        fontWeight: isSelected || isToday ? '700' : '500',
                      },
                    ]}
                  >
                    {dayNumber}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  monthLabel: {
    flexShrink: 1,
  },
  todayPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  todayPillText: {
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 2,
    marginBottom: 2,
  },
  weekdayCell: {
    width: '14.285%',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.285%',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontVariant: ['tabular-nums'],
  },
});
