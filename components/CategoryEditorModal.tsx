import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CATEGORY_ICONS,
  CURRENCIES,
  MAX_CATEGORY_NAME_LENGTH,
  assertNever,
  parseCategoryDraft,
  type Category,
  type CategoryIcon,
  type CategoryValidationErrors,
  type CurrencyCode,
  type HexColor,
  type TransactionType,
  type ValidatedCategoryDraft,
} from '../types/domain';
import { formatEditableAmount, formatInputAmount } from '../utils/money';
import {
  CATEGORY_COLOR_SWATCHES,
  RADIUS,
  SPACING,
  colorWithAlpha,
  useAppTheme,
  useReduceMotion,
  useResponsiveLayout,
} from '../utils/theme';
import { ScreenContainer } from './ScreenContainer';
import { SegmentedControl, type SegmentedOption } from './SegmentedControl';

function getNameErrorMessage(
  error: NonNullable<CategoryValidationErrors['name']>,
): string {
  switch (error) {
    case 'empty':
      return 'Enter a category name.';
    case 'too-long':
      return `Category name must be ${MAX_CATEGORY_NAME_LENGTH} characters or fewer.`;
    case 'duplicate':
      return 'A category with this name already exists.';
    default:
      return assertNever(error);
  }
}

function getBudgetErrorMessage(
  error: NonNullable<CategoryValidationErrors['monthlyBudget']>,
): string {
  switch (error) {
    case 'empty':
    case 'zero-or-negative':
      return 'Monthly budget must be greater than 0.';
    case 'invalid-format':
      return 'Enter a valid numeric budget amount.';
    case 'too-large':
      return 'Budget exceeds the maximum supported value.';
    case 'income-cannot-have-budget':
      return 'Income categories cannot have a monthly budget.';
    default:
      return assertNever(error);
  }
}

const DEFAULT_ADD_COLOR: HexColor = (() => {
  const first = CATEGORY_COLOR_SWATCHES[0];
  if (first === undefined) {
    throw new Error('Default category color swatch is unavailable');
  }
  return first;
})();

export interface CategoryEditorModalProps {
  readonly visible: boolean;
  readonly editingCategory: Category | null;
  readonly initialType: TransactionType;
  readonly currency: CurrencyCode;
  readonly allCategories: readonly Category[];
  readonly onClose: () => void;
  readonly onSave: (draft: ValidatedCategoryDraft) => void;
}

export function CategoryEditorModal({
  visible,
  editingCategory,
  initialType,
  currency,
  allCategories,
  onClose,
  onSave,
}: CategoryEditorModalProps) {
  const theme = useAppTheme();
  const reduceMotion = useReduceMotion();
  const { horizontalPadding } = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  const categoryTypeOptions = useMemo<readonly SegmentedOption<TransactionType>[]>(
    () => [
      { value: 'expense', label: 'Expense', activeColor: theme.colors.negative },
      { value: 'income', label: 'Income', activeColor: theme.colors.positive },
    ],
    [theme.colors.negative, theme.colors.positive],
  );

  const [draftType, setDraftType] = useState<TransactionType>(() =>
    editingCategory !== null ? editingCategory.type : initialType,
  );
  const [draftName, setDraftName] = useState(() =>
    editingCategory !== null ? editingCategory.name : '',
  );
  const [draftIcon, setDraftIcon] = useState<CategoryIcon>(() =>
    editingCategory !== null
      ? editingCategory.icon
      : initialType === 'expense'
        ? 'pricetag-outline'
        : 'wallet-outline',
  );
  const [draftColor, setDraftColor] = useState<HexColor>(() =>
    editingCategory !== null ? editingCategory.color : DEFAULT_ADD_COLOR,
  );
  const [draftBudgetText, setDraftBudgetText] = useState(() =>
    editingCategory !== null &&
    editingCategory.type === 'expense' &&
    editingCategory.monthlyBudget !== null
      ? formatEditableAmount(editingCategory.monthlyBudget, currency)
      : '',
  );
  const [errors, setErrors] = useState<CategoryValidationErrors>({});

  const wasVisibleRef = useRef(false);

  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (!visible || wasVisible) {
      return;
    }

    if (editingCategory !== null) {
      setDraftType(editingCategory.type);
      setDraftName(editingCategory.name);
      setDraftIcon(editingCategory.icon);
      setDraftColor(editingCategory.color);
      setDraftBudgetText(
        editingCategory.type === 'expense' &&
          editingCategory.monthlyBudget !== null
          ? formatEditableAmount(editingCategory.monthlyBudget, currency)
          : '',
      );
      setErrors({});
      return;
    }

    setDraftType(initialType);
    setDraftName('');
    setDraftIcon(
      initialType === 'expense' ? 'pricetag-outline' : 'wallet-outline',
    );
    setDraftColor(DEFAULT_ADD_COLOR);
    setDraftBudgetText('');
    setErrors({});
  }, [visible, editingCategory, initialType, currency]);

  const handleSelectDraftType = useCallback((nextType: TransactionType) => {
    setDraftType(nextType);
    if (nextType === 'income') {
      setDraftBudgetText('');
    }
    setErrors((prev) => ({
      ...prev,
      name: undefined,
      monthlyBudget: undefined,
    }));
  }, []);

  const handleBudgetChange = useCallback(
    (raw: string) => {
      setDraftBudgetText(formatInputAmount(raw, currency));
      setErrors((prev) =>
        prev.monthlyBudget !== undefined
          ? { ...prev, monthlyBudget: undefined }
          : prev,
      );
    },
    [currency],
  );

  const handleSaveCategory = useCallback(() => {
    const effectiveName = editingCategory?.isDefault
      ? editingCategory.name
      : draftName;
    const result = parseCategoryDraft(
      {
        ...(editingCategory !== null ? { id: editingCategory.id } : {}),
        type: draftType,
        name: effectiveName,
        icon: draftIcon,
        color: draftColor,
        monthlyBudgetText: draftType === 'expense' ? draftBudgetText : '',
        currency,
      },
      allCategories,
    );

    if (!result.ok) {
      setErrors(result.error);
      return;
    }

    onSave(result.value);
  }, [
    allCategories,
    currency,
    draftBudgetText,
    draftColor,
    draftIcon,
    draftName,
    draftType,
    editingCategory,
    onSave,
  ]);

  const currencyConfig = CURRENCIES[currency];
  const isDefaultEdit = editingCategory?.isDefault ?? false;
  const prefixLabel =
    currencyConfig.symbolPosition === 'prefix-space'
      ? `${currencyConfig.symbol} `
      : currencyConfig.symbol;
  const budgetKeyboardType =
    currencyConfig.decimals === 0 ? 'number-pad' : 'decimal-pad';

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.modalRoot, { backgroundColor: theme.colors.canvas }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={[
            styles.modalHeader,
            {
              backgroundColor: theme.colors.surface,
              borderBottomColor: theme.colors.divider,
              paddingTop: Platform.OS === 'android' ? insets.top : 0,
              minHeight: 56 + (Platform.OS === 'android' ? insets.top : 0),
            },
          ]}
        >
          <ScreenContainer
            style={[
              styles.modalHeaderInner,
              {
                paddingHorizontal: Math.max(
                  SPACING.sm,
                  horizontalPadding - SPACING.sm,
                ),
              },
            ]}
          >
            <Pressable
              onPress={onClose}
              android_ripple={{
                color: theme.colors.ripple,
                borderless: true,
                radius: 24,
              }}
              style={({ pressed }) => [
                styles.modalCloseButton,
                Platform.OS !== 'android' &&
                  pressed && { backgroundColor: theme.colors.surfaceMuted },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>

            <Text
              style={[
                theme.typography.sectionTitle,
                { color: theme.colors.text },
              ]}
            >
              {editingCategory !== null ? 'Edit category' : 'New category'}
            </Text>

            <View style={styles.modalHeaderSpacer} />
          </ScreenContainer>
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={[
            styles.modalScrollContent,
            { paddingHorizontal: horizontalPadding },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ScreenContainer style={styles.modalColumn}>
            <View style={styles.previewRow}>
              <View
                style={[
                  styles.previewBadge,
                  {
                    backgroundColor: colorWithAlpha(
                      draftColor,
                      theme.isDark ? 0.24 : 0.14,
                    ),
                  },
                ]}
              >
                <Ionicons name={draftIcon} size={26} color={draftColor} />
              </View>
              <View style={styles.previewTextCol}>
                <Text
                  style={[
                    theme.typography.sectionTitle,
                    { color: theme.colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {draftName.trim().length > 0
                    ? draftName.trim()
                    : 'Category name'}
                </Text>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {draftType === 'expense'
                    ? 'Expense category'
                    : 'Income category'}
                </Text>
              </View>
            </View>

            {editingCategory === null ? (
              <SegmentedControl
                value={draftType}
                onChange={handleSelectDraftType}
                options={categoryTypeOptions}
              />
            ) : null}

            <View
              style={[
                styles.fieldCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: errors.name
                    ? theme.colors.negative
                    : theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.caption,
                  styles.fieldLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Name
              </Text>
              <TextInput
                value={draftName}
                onChangeText={(text) => {
                  setDraftName(text);
                  setErrors((prev) =>
                    prev.name !== undefined
                      ? { ...prev, name: undefined }
                      : prev,
                  );
                }}
                editable={!isDefaultEdit}
                placeholder="e.g. Groceries, Freelance"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={MAX_CATEGORY_NAME_LENGTH}
                returnKeyType="done"
                style={[
                  theme.typography.body,
                  styles.textInput,
                  {
                    color: isDefaultEdit
                      ? theme.colors.textSecondary
                      : theme.colors.text,
                  },
                ]}
                accessibilityLabel="Category name"
              />
              {isDefaultEdit ? (
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  Default category name cannot be changed
                </Text>
              ) : null}
              {errors.name ? (
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.negative },
                  ]}
                >
                  {getNameErrorMessage(errors.name)}
                </Text>
              ) : null}
            </View>

            {draftType === 'expense' ? (
              <View
                style={[
                  styles.fieldCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: errors.monthlyBudget
                      ? theme.colors.negative
                      : theme.colors.border,
                  },
                ]}
              >
                <View style={styles.budgetHeaderRow}>
                  <Text
                    style={[
                      theme.typography.caption,
                      styles.fieldLabel,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Monthly budget (optional)
                  </Text>
                  {draftBudgetText.length > 0 ? (
                    <Pressable
                      onPress={() => handleBudgetChange('')}
                      android_ripple={{ color: theme.colors.ripple }}
                      style={({ pressed }) => [
                        styles.clearBudgetButton,
                        Platform.OS !== 'android' &&
                          pressed &&
                          styles.clearBudgetButtonPressed,
                      ]}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel="Clear monthly budget"
                    >
                      <Text
                        style={[
                          theme.typography.caption,
                          styles.clearBudgetText,
                          { color: theme.colors.accent },
                        ]}
                      >
                        Clear
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.budgetInputRow}>
                  <Text
                    style={[
                      theme.typography.sectionTitle,
                      styles.currencyPrefix,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    {prefixLabel}
                  </Text>
                  <TextInput
                    value={draftBudgetText}
                    onChangeText={handleBudgetChange}
                    placeholder="No limit"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType={budgetKeyboardType}
                    returnKeyType="done"
                    style={[
                      theme.typography.pageTitle,
                      styles.budgetInput,
                      { color: theme.colors.text },
                    ]}
                    accessibilityLabel="Monthly budget amount"
                  />
                </View>

                {errors.monthlyBudget ? (
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.negative },
                    ]}
                  >
                    {getBudgetErrorMessage(errors.monthlyBudget)}
                  </Text>
                ) : (
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    Shows alerts at 80% and 100% of your monthly limit.
                  </Text>
                )}
              </View>
            ) : null}

            <View
              style={[
                styles.fieldCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.caption,
                  styles.fieldLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Color
              </Text>
              <View style={styles.swatchGrid}>
                {CATEGORY_COLOR_SWATCHES.map((swatch) => {
                  const isSelected = draftColor === swatch;
                  return (
                    <Pressable
                      key={swatch}
                      onPress={() => setDraftColor(swatch)}
                      android_ripple={{ color: theme.colors.ripple }}
                      style={({ pressed }) => [
                        styles.swatchButton,
                        { backgroundColor: swatch },
                        isSelected && {
                          borderWidth: 3,
                          borderColor: theme.colors.text,
                        },
                        Platform.OS !== 'android' &&
                          pressed && { opacity: 0.8 },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`Color ${swatch}`}
                    >
                      {isSelected ? (
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={theme.colors.onColorSwatch}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View
              style={[
                styles.fieldCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.caption,
                  styles.fieldLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Icon
              </Text>
              <View style={styles.iconGrid}>
                {CATEGORY_ICONS.map((iconName) => {
                  const isSelected = draftIcon === iconName;
                  return (
                    <Pressable
                      key={iconName}
                      onPress={() => setDraftIcon(iconName)}
                      android_ripple={{ color: theme.colors.ripple }}
                      style={({ pressed }) => [
                        styles.iconChoice,
                        {
                          backgroundColor: isSelected
                            ? colorWithAlpha(
                                draftColor,
                                theme.isDark ? 0.26 : 0.14,
                              )
                            : Platform.OS !== 'android' && pressed
                              ? theme.colors.surfaceMuted
                              : theme.colors.canvas,
                          borderColor: isSelected
                            ? draftColor
                            : theme.colors.border,
                        },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`Icon ${iconName}`}
                    >
                      <Ionicons
                        name={iconName}
                        size={20}
                        color={
                          isSelected
                            ? draftColor
                            : theme.colors.textSecondary
                        }
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScreenContainer>
        </ScrollView>

        <View
          style={[
            styles.modalFooter,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.divider,
              paddingHorizontal: horizontalPadding,
              paddingBottom: Math.max(insets.bottom, SPACING.md),
            },
          ]}
        >
          <ScreenContainer>
            <Pressable
              onPress={handleSaveCategory}
              android_ripple={{ color: theme.colors.ripple }}
              style={({ pressed }) => [
                styles.saveButton,
                {
                  backgroundColor:
                    Platform.OS !== 'android' && pressed
                      ? theme.colors.accentPressed
                      : theme.colors.accent,
                },
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  theme.typography.sectionTitle,
                  { color: theme.colors.onAccent },
                ]}
              >
                {editingCategory !== null
                  ? 'Save changes'
                  : 'Create category'}
              </Text>
            </Pressable>
          </ScreenContainer>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  modalHeader: {
    borderBottomWidth: 1,
    justifyContent: 'center',
  },
  modalHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  modalCloseButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderSpacer: {
    width: 48,
    height: 48,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingTop: SPACING.lg,
    paddingBottom: 28,
  },
  modalColumn: {
    gap: 14,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: SPACING.xs,
  },
  previewBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTextCol: {
    flex: 1,
    gap: 2,
  },
  fieldCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  fieldLabel: {
    fontWeight: '600',
  },
  textInput: {
    fontWeight: '500',
    paddingVertical: SPACING.xs,
    minHeight: 36,
  },
  budgetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearBudgetButton: {
    minHeight: 40,
    minWidth: 48,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  clearBudgetButtonPressed: {
    opacity: 0.7,
  },
  clearBudgetText: {
    fontWeight: '600',
  },
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  currencyPrefix: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  budgetInput: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
    paddingVertical: SPACING.xs,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 2,
  },
  swatchButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingTop: 2,
  },
  iconChoice: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    paddingTop: SPACING.md,
    borderTopWidth: 1,
  },
  saveButton: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
