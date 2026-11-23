import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import {
  colorWithAlpha,
  useAppTheme,
  useReduceMotion,
  useResponsiveLayout,
} from '../utils/theme';

export interface FloatingAddButtonProps {
  readonly onPress: () => void;
  readonly accessibilityLabel?: string;
  readonly bottomOffset?: number;
}

export function FloatingAddButton({
  onPress,
  accessibilityLabel = 'Add transaction',
  bottomOffset = 20,
}: FloatingAddButtonProps) {
  const theme = useAppTheme();
  const reduceMotion = useReduceMotion();
  const { width, isWide, contentMaxWidth } = useResponsiveLayout();

  const rightOffset = isWide
    ? Math.round((width - contentMaxWidth) / 2) + theme.spacing.xl
    : theme.spacing.xl;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colorWithAlpha(theme.colors.onAccent, 0.18) }}
      style={({ pressed }) => [
        styles.button,
        theme.shadows.floating,
        {
          bottom: bottomOffset,
          right: rightOffset,
          backgroundColor: pressed
            ? theme.colors.accentPressed
            : theme.colors.accent,
          transform: [{ scale: pressed && !reduceMotion ? 0.94 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name="add" size={28} color={theme.colors.onAccent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
