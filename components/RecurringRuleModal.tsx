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
import type { RecurringRuleDraft } from '../db/store';
import {
  CURRENCIES,
  MAX_NOTE_LENGTH,
  parseAmountInput,
  type AmountError,
  type Category,
  type CategoryId,
  type CurrencyCode,
  type TransactionType,
  type YearMonth,
} from '../types/domain';
import { formatShortMonthLabel, stepYearMonth } from '../utils/date';
import { formatInputAmount, getAmountErrorMessage } from '../utils/money';
import {
  RADIUS,
  SPACING,
  useAppTheme,
  useReduceMotion,
  useResponsiveLayout,
} from '../utils/theme';
import { CategoryChipGrid } from './CategoryChipGrid';
import { ScreenContainer } from './ScreenContainer';
import { SegmentedControl, type SegmentedOption } from './SegmentedControl';

interface RecurringDraftErrors {
  readonly amount?: AmountError;
  readonly categoryId?: 'required' | 'category-type-mismatch';
  readonly note?: 'too-long';
}

export interface RecurringRuleModalProps {
  readonly visible: boolean;
  readonly currency: CurrencyCode;
  readonly categories: readonly Category[];
  readonly defaultStartMonth: YearMonth;
  readonly onClose: () => void;
  readonly onSave: (draft: RecurringRuleDraft) => void;
}

export function RecurringRuleModal({
  visible,
  currency,
  categories,
  defaultStartMonth,
  onClose,
  onSave,
}: RecurringRuleModalProps) {
  const theme = useAppTheme();
  const reduceMotion = useReduceMotion();
  const { horizontalPadding } = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  const ruleTypeOptions = useMemo<readonly SegmentedOption<TransactionType>[]>(
    () => [
      { value: 'expense', label: 'Expense', activeColor: theme.colors.negative },
      { value: 'income', label: 'Income', activeColor: theme.colors.positive },
    ],
    [theme.colors.negative, theme.colors.positive],
  );

  const [ruleType, setRuleType] = useState<TransactionType>('expense');
  const [ruleAmountText, setRuleAmountText] = useState('');
  const [ruleCategoryId, setRuleCategoryId] = useState<CategoryId | null>(null);
  const [ruleDayOfMonth, setRuleDayOfMonth] = useState(1);
  const [ruleNote, setRuleNote] = useState('');
  const [ruleStartMonth, setRuleStartMonth] =
    useState<YearMonth>(defaultStartMonth);
  const [ruleErrors, setRuleErrors] = useState<RecurringDraftErrors>({});

  const wasVisibleRef = useRef(false);

  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (visible && !wasVisible) {
      setRuleType('expense');
      setRuleAmountText('');
      setRuleCategoryId(null);
      setRuleDayOfMonth(1);
      setRuleNote('');
      setRuleStartMonth(defaultStartMonth);
      setRuleErrors({});
    }
  }, [visible, defaultStartMonth]);

  const categoryById = useMemo(() => {
    const map = new Map<CategoryId, Category>();
    for (const category of categories) {
      map.set(category.id, category);
    }
    return map;
  }, [categories]);

  const ruleModalCategories = useMemo(
    () => categories.filter((category) => category.type === ruleType),
    [categories, ruleType],
  );

  const handleSelectRuleType = useCallback(
    (nextType: TransactionType) => {
      if (nextType === ruleType) {
        return;
      }
      setRuleType(nextType);
      setRuleCategoryId(null);
      setRuleErrors((prev) => ({ ...prev, categoryId: undefined }));
    },
    [ruleType],
  );

  const handleRuleAmountChange = useCallback(
    (raw: string) => {
      setRuleAmountText(formatInputAmount(raw, currency));
      setRuleErrors((prev) =>
        prev.amount !== undefined ? { ...prev, amount: undefined } : prev,
      );
    },
    [currency],
  );

  const handleSelectRuleCategory = useCallback((id: CategoryId) => {
    setRuleCategoryId(id);
    setRuleErrors((prev) =>
      prev.categoryId !== undefined ? { ...prev, categoryId: undefined } : prev,
    );
  }, []);

  const handleStepDayOfMonth = useCallback((delta: number) => {
    setRuleDayOfMonth((prev) => Math.min(31, Math.max(1, prev + delta)));
  }, []);

  const handleSaveRule = useCallback(() => {
    let hasError = false;
    let amountError: AmountError | undefined;
    let categoryError: RecurringDraftErrors['categoryId'];
    let noteError: RecurringDraftErrors['note'];

    const amountResult = parseAmountInput(ruleAmountText, currency);
    if (!amountResult.ok) {
      amountError = amountResult.error;
      hasError = true;
    }

    if (ruleCategoryId === null) {
      categoryError = 'required';
      hasError = true;
    } else {
      const matched = categoryById.get(ruleCategoryId);
      if (!matched || matched.type !== ruleType) {
        categoryError = 'category-type-mismatch';
        hasError = true;
      }
    }

    const trimmedNote = ruleNote.trim();
    if (trimmedNote.length > MAX_NOTE_LENGTH) {
      noteError = 'too-long';
      hasError = true;
    }

    if (hasError || !amountResult.ok || ruleCategoryId === null) {
      setRuleErrors({
        ...(amountError ? { amount: amountError } : {}),
        ...(categoryError ? { categoryId: categoryError } : {}),
        ...(noteError ? { note: noteError } : {}),
      });
      return;
    }

    onSave({
      type: ruleType,
      amount: amountResult.value,
      categoryId: ruleCategoryId,
      dayOfMonth: ruleDayOfMonth,
      note: trimmedNote,
      startMonth: ruleStartMonth,
      isActive: true,
    });
  }, [
    categoryById,
    currency,
    onSave,
    ruleAmountText,
    ruleCategoryId,
    ruleDayOfMonth,
    ruleNote,
    ruleStartMonth,
    ruleType,
  ]);

  const currencyConfig = CURRENCIES[currency];
  const prefixLabel =
    currencyConfig.symbolPosition === 'prefix-space'
      ? `${currencyConfig.symbol} `
      : currencyConfig.symbol;
  const amountKeyboardType =
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
              New recurring rule
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
            <SegmentedControl
              value={ruleType}
              onChange={handleSelectRuleType}
              options={ruleTypeOptions}
            />

            <View
              style={[
                styles.fieldCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: ruleErrors.amount
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
                Amount
              </Text>
              <View style={styles.amountInputRow}>
                <Text
                  style={[
                    theme.typography.pageTitle,
                    styles.currencyPrefix,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {prefixLabel}
                </Text>
                <TextInput
                  value={ruleAmountText}
                  onChangeText={handleRuleAmountChange}
                  placeholder="0"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType={amountKeyboardType}
                  returnKeyType="done"
                  style={[
                    theme.typography.display,
                    styles.amountInput,
                    { color: theme.colors.text },
                  ]}
                  accessibilityLabel="Recurring amount"
                />
              </View>
              {ruleErrors.amount ? (
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.negative },
                  ]}
                >
                  {getAmountErrorMessage(ruleErrors.amount)}
                </Text>
              ) : null}
            </View>

            <View style={styles.fieldBlock}>
              <Text
                style={[
                  theme.typography.caption,
                  styles.fieldLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Category
              </Text>
              <CategoryChipGrid
                categories={ruleModalCategories}
                selectedCategoryId={ruleCategoryId}
                onSelect={handleSelectRuleCategory}
                error={
                  ruleErrors.categoryId
                    ? ruleErrors.categoryId === 'required'
                      ? 'Select a category.'
                      : 'Category does not match type.'
                    : undefined
                }
              />
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
                Day of month
              </Text>
              <View style={styles.stepperRow}>
                <Pressable
                  onPress={() => handleStepDayOfMonth(-1)}
                  disabled={ruleDayOfMonth <= 1}
                  android_ripple={{ color: theme.colors.ripple }}
                  style={({ pressed }) => [
                    styles.stepperButton,
                    {
                      backgroundColor:
                        Platform.OS !== 'android' && pressed
                          ? theme.colors.surfaceMuted
                          : theme.colors.canvas,
                      borderColor: theme.colors.border,
                      opacity: ruleDayOfMonth <= 1 ? 0.45 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease day of month"
                >
                  <Ionicons
                    name="remove"
                    size={18}
                    color={theme.colors.text}
                  />
                </Pressable>

                <View
                  style={[
                    styles.stepperValueBox,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      theme.typography.bodyStrong,
                      styles.stepperValue,
                      { color: theme.colors.text },
                    ]}
                  >
                    {`Day ${ruleDayOfMonth}`}
                  </Text>
                </View>

                <Pressable
                  onPress={() => handleStepDayOfMonth(1)}
                  disabled={ruleDayOfMonth >= 31}
                  android_ripple={{ color: theme.colors.ripple }}
                  style={({ pressed }) => [
                    styles.stepperButton,
                    {
                      backgroundColor:
                        Platform.OS !== 'android' && pressed
                          ? theme.colors.surfaceMuted
                          : theme.colors.canvas,
                      borderColor: theme.colors.border,
                      opacity: ruleDayOfMonth >= 31 ? 0.45 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Increase day of month"
                >
                  <Ionicons name="add" size={18} color={theme.colors.text} />
                </Pressable>
              </View>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textMuted },
                ]}
              >
                Shorter months use the last day of the month.
              </Text>
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
                Start month
              </Text>
              <View style={styles.stepperRow}>
                <Pressable
                  onPress={() =>
                    setRuleStartMonth((prev) => stepYearMonth(prev, -1))
                  }
                  android_ripple={{ color: theme.colors.ripple }}
                  style={({ pressed }) => [
                    styles.stepperButton,
                    {
                      backgroundColor:
                        Platform.OS !== 'android' && pressed
                          ? theme.colors.surfaceMuted
                          : theme.colors.canvas,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Previous start month"
                >
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={theme.colors.text}
                  />
                </Pressable>

                <View
                  style={[
                    styles.stepperValueBox,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      theme.typography.bodyStrong,
                      styles.stepperValue,
                      { color: theme.colors.text },
                    ]}
                  >
                    {formatShortMonthLabel(ruleStartMonth)}
                  </Text>
                </View>

                <Pressable
                  onPress={() =>
                    setRuleStartMonth((prev) => stepYearMonth(prev, 1))
                  }
                  android_ripple={{ color: theme.colors.ripple }}
                  style={({ pressed }) => [
                    styles.stepperButton,
                    {
                      backgroundColor:
                        Platform.OS !== 'android' && pressed
                          ? theme.colors.surfaceMuted
                          : theme.colors.canvas,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Next start month"
                >
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.colors.text}
                  />
                </Pressable>
              </View>
            </View>

            <View
              style={[
                styles.fieldCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: ruleErrors.note
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
                Note (optional)
              </Text>
              <TextInput
                value={ruleNote}
                onChangeText={(text) => {
                  setRuleNote(text);
                  setRuleErrors((prev) =>
                    prev.note !== undefined ? { ...prev, note: undefined } : prev,
                  );
                }}
                placeholder="e.g. Monthly rent, Salary"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={MAX_NOTE_LENGTH}
                returnKeyType="done"
                style={[
                  theme.typography.body,
                  styles.noteInput,
                  { color: theme.colors.text },
                ]}
                accessibilityLabel="Recurring note"
              />
              {ruleErrors.note ? (
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.negative },
                  ]}
                >
                  {`Note must be ${MAX_NOTE_LENGTH} characters or fewer.`}
                </Text>
              ) : null}
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
              onPress={handleSaveRule}
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
                Save recurring rule
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
  fieldBlock: {
    gap: SPACING.sm,
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
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  currencyPrefix: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    lineHeight: 34,
    fontVariant: ['tabular-nums'],
    paddingVertical: SPACING.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueBox: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  stepperValue: {
    fontVariant: ['tabular-nums'],
  },
  noteInput: {
    paddingVertical: SPACING.xs,
    minHeight: 36,
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
