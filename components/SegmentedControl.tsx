import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colorWithAlpha, useAppTheme } from '../utils/theme';

export interface SegmentedOption<T extends string | number> {
  readonly value: T;
  readonly label: string;
  readonly activeColor?: string;
}

export interface SegmentedControlProps<T extends string | number> {
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly options: readonly SegmentedOption<T>[];
  readonly style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  style,
}: SegmentedControlProps<T>) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: theme.colors.border,
          borderRadius: theme.radius.pill,
        },
        style,
      ]}
      accessibilityRole="tablist"
    >
      {options.map((option, index) => {
        const isSelected = value === option.value;
        const isSemanticActiveColor =
          option.activeColor === theme.colors.negative ||
          option.activeColor === theme.colors.positive;
        const selectedBackground =
          isSemanticActiveColor && option.activeColor !== undefined
            ? colorWithAlpha(option.activeColor, theme.isDark ? 0.22 : 0.12)
            : theme.colors.accentSoft;
        const activeTextColor = option.activeColor ?? theme.colors.accent;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            android_ripple={{ color: theme.colors.ripple }}
            style={({ pressed }) => [
              styles.segment,
              index > 0 && {
                borderLeftWidth: StyleSheet.hairlineWidth,
                borderLeftColor: theme.colors.border,
              },
              isSelected && { backgroundColor: selectedBackground },
              Platform.OS !== 'android' && pressed && styles.segmentPressed,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.label}
          >
            <Text
              style={[
                styles.label,
                {
                  color: isSelected
                    ? activeTextColor
                    : theme.colors.textSecondary,
                  fontWeight: isSelected ? '600' : '500',
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    minHeight: 44,
    borderWidth: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  segmentPressed: {
    opacity: 0.78,
  },
  label: {
    fontSize: 13,
  },
});
