import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category, CategoryId } from '../types/domain';
import { colorWithAlpha, useAppTheme } from '../utils/theme';

export interface CategoryChipGridProps {
  readonly categories: readonly Category[];
  readonly selectedCategoryId: CategoryId | null;
  readonly onSelect: (categoryId: CategoryId) => void;
  readonly error?: string;
}

export function CategoryChipGrid({
  categories,
  selectedCategoryId,
  onSelect,
  error,
}: CategoryChipGridProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { gap: theme.spacing.sm }]}>
      <View
        style={[styles.grid, { gap: theme.spacing.sm }]}
        accessibilityRole="radiogroup"
      >
        {categories.map((category) => {
          const isSelected = category.id === selectedCategoryId;
          const activeFill = colorWithAlpha(
            category.color,
            theme.isDark ? 0.24 : 0.12,
          );

          return (
            <Pressable
              key={category.id}
              onPress={() => onSelect(category.id)}
              style={({ pressed }) => [
                styles.chip,
                !isSelected && !theme.isDark && theme.shadows.card,
                {
                  borderRadius: theme.radius.md,
                  backgroundColor: isSelected
                    ? activeFill
                    : pressed
                      ? theme.colors.surfaceMuted
                      : theme.colors.surface,
                  borderColor: isSelected ? category.color : theme.colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={category.name}
            >
              <Ionicons name={category.icon} size={17} color={category.color} />
              <Text
                style={[
                  styles.chipLabel,
                  {
                    color: theme.colors.text,
                    fontWeight: isSelected ? '600' : '500',
                  },
                ]}
                numberOfLines={1}
              >
                {category.name}
              </Text>
              {isSelected ? (
                <Ionicons name="checkmark" size={15} color={category.color} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: theme.colors.negative }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipLabel: {
    fontSize: 14,
    maxWidth: 160,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
