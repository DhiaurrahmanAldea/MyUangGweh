import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryEditorModal } from '../components/CategoryEditorModal';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  SegmentedControl,
  type SegmentedOption,
} from '../components/SegmentedControl';
import {
  useBudgetStore,
  useCategories,
  useSettings,
} from '../db/BudgetProvider';
import type {
  Category,
  TransactionType,
  ValidatedCategoryDraft,
} from '../types/domain';
import type { RootStackNavigationProp } from '../types/navigation';
import { formatMoney } from '../utils/money';
import {
  RADIUS,
  SPACING,
  colorWithAlpha,
  useAppTheme,
  useReduceMotion,
  useResponsiveLayout,
} from '../utils/theme';

export function CategoriesScreen() {
  const theme = useAppTheme();
  const reduceMotion = useReduceMotion();
  const { horizontalPadding } = useResponsiveLayout();
  const navigation = useNavigation<RootStackNavigationProp>();
  const store = useBudgetStore();
  const settings = useSettings();
  const allCategories = useCategories();
  const expenseCategories = useCategories('expense');
  const incomeCategories = useCategories('income');

  const categoryTypeOptions = useMemo<readonly SegmentedOption<TransactionType>[]>(
    () => [
      { value: 'expense', label: 'Expense', activeColor: theme.colors.negative },
      { value: 'income', label: 'Income', activeColor: theme.colors.positive },
    ],
    [theme.colors.negative, theme.colors.positive],
  );

  const [selectedType, setSelectedType] = useState<TransactionType>('expense');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const verticalScrollRef = useRef<ScrollViewInstance>(null);
  const listOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      listOpacity.stopAnimation();
      listOpacity.setValue(1);
    }
  }, [listOpacity, reduceMotion]);

  const animateListTransition = useCallback(() => {
    listOpacity.stopAnimation();
    if (reduceMotion) {
      listOpacity.setValue(1);
      return;
    }
    listOpacity.setValue(0.25);
    Animated.timing(listOpacity, {
      toValue: 1,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [listOpacity, reduceMotion]);

  const handleSelectType = useCallback(
    (nextType: TransactionType) => {
      if (nextType === selectedType) {
        return;
      }
      setSelectedType(nextType);
      verticalScrollRef.current?.scrollTo({ y: 0, animated: false });
      animateListTransition();
    },
    [animateListTransition, selectedType],
  );

  const openAddModal = useCallback(() => {
    setEditingCategory(null);
    setModalVisible(true);
  }, []);

  const openEditModal = useCallback((category: Category) => {
    setEditingCategory(category);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const handleSaveCategory = useCallback(
    (draft: ValidatedCategoryDraft) => {
      const saved = store.saveCategory(draft);
      if (saved.type !== selectedType) {
        setSelectedType(saved.type);
        verticalScrollRef.current?.scrollTo({ y: 0, animated: false });
        animateListTransition();
      }
      setModalVisible(false);
    },
    [animateListTransition, selectedType, store],
  );

  const handleConfirmDelete = useCallback(
    (category: Category) => {
      if (category.isDefault) {
        return;
      }
      Alert.alert(
        `Delete "${category.name}"?`,
        'Any linked transactions or recurring rules will be reassigned to "Other".',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              store.deleteCategory(category.id);
            },
          },
        ],
      );
    },
    [store],
  );

  const visibleCategories =
    selectedType === 'expense' ? expenseCategories : incomeCategories;

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: theme.colors.canvas }]}
    >
      <ScreenContainer
        style={[styles.topBar, { paddingHorizontal: horizontalPadding }]}
      >
        <Text style={[theme.typography.pageTitle, { color: theme.colors.text }]}>
          Categories
        </Text>

        <View style={styles.topActions}>
          <Pressable
            onPress={openAddModal}
            android_ripple={{ color: theme.colors.ripple }}
            style={({ pressed }) => [
              styles.addButton,
              {
                backgroundColor:
                  Platform.OS !== 'android' && pressed
                    ? theme.colors.surfaceMuted
                    : theme.colors.accentSoft,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add category"
          >
            <Ionicons
              name="add-outline"
              size={18}
              color={theme.colors.accent}
            />
            <Text
              style={[
                theme.typography.caption,
                styles.addButtonText,
                { color: theme.colors.accent },
              ]}
            >
              Add
            </Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Settings')}
            android_ripple={{
              color: theme.colors.ripple,
              borderless: true,
              radius: 24,
            }}
            style={({ pressed }) => [
              styles.settingsButton,
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
        </View>
      </ScreenContainer>

      <ScreenContainer
        style={[
          styles.segmentedWrapper,
          { paddingHorizontal: horizontalPadding },
        ]}
      >
        <SegmentedControl
          value={selectedType}
          onChange={handleSelectType}
          options={categoryTypeOptions}
        />
      </ScreenContainer>

      <Animated.View style={[styles.scroll, { opacity: listOpacity }]}>
        <ScrollView
          ref={verticalScrollRef}
          style={styles.scroll}
          nestedScrollEnabled={true}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: horizontalPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ScreenContainer style={styles.listColumn}>
            <View
              style={[
                styles.listCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {visibleCategories.map((category, index) => {
                const iconBg = colorWithAlpha(
                  category.color,
                  theme.isDark ? 0.22 : 0.13,
                );
                const budgetLabel =
                  category.type === 'expense' &&
                  category.monthlyBudget !== null
                    ? `${formatMoney(category.monthlyBudget, settings.currency)} / mo`
                    : null;

                return (
                  <View key={category.id}>
                    <View style={styles.categoryRow}>
                      <Pressable
                        onPress={() => openEditModal(category)}
                        android_ripple={{ color: theme.colors.ripple }}
                        style={({ pressed }) => [
                          styles.categoryMainTap,
                          Platform.OS !== 'android' &&
                            pressed && {
                              backgroundColor: theme.colors.surfaceMuted,
                            },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${category.name} category`}
                      >
                        <View
                          style={[
                            styles.iconBadge,
                            { backgroundColor: iconBg },
                          ]}
                        >
                          <Ionicons
                            name={category.icon}
                            size={20}
                            color={category.color}
                          />
                        </View>

                        <View style={styles.categoryTextCol}>
                          <Text
                            style={[
                              theme.typography.bodyStrong,
                              styles.categoryName,
                              { color: theme.colors.text },
                            ]}
                            numberOfLines={1}
                          >
                            {category.name}
                          </Text>
                          {budgetLabel !== null ? (
                            <Text
                              style={[
                                theme.typography.caption,
                                styles.budgetSubtitle,
                                { color: theme.colors.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {budgetLabel}
                            </Text>
                          ) : null}
                        </View>

                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={theme.colors.textMuted}
                        />
                      </Pressable>

                      {!category.isDefault ? (
                        <Pressable
                          onPress={() => handleConfirmDelete(category)}
                          android_ripple={{
                            color: theme.colors.ripple,
                            borderless: true,
                            radius: 24,
                          }}
                          style={({ pressed }) => [
                            styles.deleteIconButton,
                            Platform.OS !== 'android' &&
                              pressed && {
                                backgroundColor: theme.colors.negativeSoft,
                              },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${category.name} category`}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color={theme.colors.negative}
                          />
                        </Pressable>
                      ) : null}
                    </View>

                    {index < visibleCategories.length - 1 ? (
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

            {selectedType === 'expense' ? (
              <Text
                style={[
                  theme.typography.caption,
                  styles.listHint,
                  { color: theme.colors.textMuted },
                ]}
              >
                Tap any category to edit its icon, color, or monthly budget limit.
              </Text>
            ) : null}
          </ScreenContainer>
        </ScrollView>
      </Animated.View>

      <CategoryEditorModal
        visible={modalVisible}
        editingCategory={editingCategory}
        initialType={selectedType}
        currency={settings.currency}
        allCategories={allCategories}
        onClose={closeModal}
        onSave={handleSaveCategory}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    minHeight: 52,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  addButtonText: {
    fontWeight: '600',
  },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedWrapper: {
    marginBottom: SPACING.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  listColumn: {
    gap: SPACING.md,
  },
  listCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listHint: {
    textAlign: 'center',
    paddingHorizontal: SPACING.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryMainTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    minHeight: 62,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTextCol: {
    flex: 1,
    gap: 2,
  },
  categoryName: {
    flexShrink: 1,
  },
  budgetSubtitle: {
    fontVariant: ['tabular-nums'],
  },
  deleteIconButton: {
    width: 48,
    height: 48,
    marginRight: 4,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
});
