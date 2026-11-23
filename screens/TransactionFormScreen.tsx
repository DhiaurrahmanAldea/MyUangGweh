import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
  type TextInputInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDropdown } from '../components/CalendarDropdown';
import { CategoryChipGrid } from '../components/CategoryChipGrid';
import { ReceiptPickerCard } from '../components/ReceiptPickerCard';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  SegmentedControl,
  type SegmentedOption,
} from '../components/SegmentedControl';
import {
  useBudgetStore,
  useCategories,
  useSelectedMonth,
  useSettings,
  useTransaction,
} from '../db/BudgetProvider';
import {
  CURRENCIES,
  MAX_NOTE_LENGTH,
  assertNever,
  parseIsoDate,
  parseTransactionDraft,
  type CategoryId,
  type IsoDate,
  type TransactionId,
  type TransactionType,
  type TransactionValidationErrors,
} from '../types/domain';
import type { RootStackScreenProps } from '../types/navigation';
import {
  formatFullDateLabel,
  isoDateToYearMonth,
  shiftIsoDate,
  todayIsoDate,
} from '../utils/date';
import {
  formatEditableAmount,
  formatInputAmount,
  getAmountErrorMessage,
} from '../utils/money';
import { deleteReceiptImageQuietly } from '../utils/receipt';
import {
  RADIUS,
  SPACING,
  useAppTheme,
  useResponsiveLayout,
} from '../utils/theme';

function getCategoryErrorMessage(
  error: NonNullable<TransactionValidationErrors['categoryId']>,
): string {
  switch (error) {
    case 'required':
      return 'Select a category.';
    case 'category-type-mismatch':
      return 'Selected category does not match transaction type.';
    case 'not-found':
      return 'Selected category no longer exists.';
    default:
      return assertNever(error);
  }
}

function getDateErrorMessage(
  error: NonNullable<TransactionValidationErrors['date']>,
): string {
  switch (error) {
    case 'invalid-date':
      return 'Enter a valid date in YYYY-MM-DD format.';
    default:
      return assertNever(error);
  }
}

function getNoteErrorMessage(
  error: NonNullable<TransactionValidationErrors['note']>,
): string {
  switch (error) {
    case 'too-long':
      return `Note must be ${MAX_NOTE_LENGTH} characters or fewer.`;
    default:
      return assertNever(error);
  }
}

function getReceiptErrorMessage(
  error: NonNullable<TransactionValidationErrors['receiptUri']>,
): string {
  switch (error) {
    case 'invalid-receipt':
      return 'Attached receipt path is invalid.';
    default:
      return assertNever(error);
  }
}

export function TransactionFormScreen({
  route,
  navigation,
}: RootStackScreenProps<'TransactionForm'>) {
  const theme = useAppTheme();
  const { horizontalPadding } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const store = useBudgetStore();
  const settings = useSettings();
  const allCategories = useCategories();
  const { selectedMonth, setSelectedMonth } = useSelectedMonth();

  const isEdit = route.params.mode === 'edit';
  const editTransactionId =
    route.params.mode === 'edit' ? route.params.transactionId : null;
  const existingTransaction = useTransaction(editTransactionId);

  const currencyConfig = CURRENCIES[settings.currency];

  const [type, setType] = useState<TransactionType>(() => {
    if (existingTransaction) {
      return existingTransaction.type;
    }
    return route.params.mode === 'create'
      ? (route.params.initialType ?? 'expense')
      : 'expense';
  });
  const [amountText, setAmountText] = useState<string>(() =>
    existingTransaction
      ? formatEditableAmount(existingTransaction.amount, settings.currency)
      : '',
  );
  const [categoryId, setCategoryId] = useState<CategoryId | null>(() =>
    existingTransaction ? existingTransaction.categoryId : null,
  );
  const [dateText, setDateText] = useState<string>(() =>
    existingTransaction ? existingTransaction.date : todayIsoDate(),
  );
  const [note, setNote] = useState<string>(() =>
    existingTransaction ? existingTransaction.note : '',
  );
  const [receiptUri, setReceiptUri] = useState<string | null>(() =>
    existingTransaction ? existingTransaction.receiptUri : null,
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const [errors, setErrors] = useState<TransactionValidationErrors>({});

  const typeOptions = useMemo<readonly SegmentedOption<TransactionType>[]>(
    () => [
      { value: 'expense', label: 'Expense', activeColor: theme.colors.negative },
      { value: 'income', label: 'Income', activeColor: theme.colors.positive },
    ],
    [theme.colors.negative, theme.colors.positive],
  );

  const scrollViewRef = useRef<ScrollViewInstance>(null);
  const amountInputRef = useRef<TextInputInstance>(null);
  const noteCardYRef = useRef(0);
  const isNoteFocusedRef = useRef(false);
  const hydratedIdRef = useRef<TransactionId | null>(
    existingTransaction?.id ?? null,
  );
  const initialReceiptUriRef = useRef<string | null>(
    existingTransaction?.receiptUri ?? null,
  );
  const createdDraftUrisRef = useRef<Set<string>>(new Set());
  const didSaveRef = useRef(false);
  const isDeletingRef = useRef(false);

  useEffect(() => {
    if (
      existingTransaction &&
      hydratedIdRef.current !== existingTransaction.id
    ) {
      hydratedIdRef.current = existingTransaction.id;
      initialReceiptUriRef.current = existingTransaction.receiptUri;
      setType(existingTransaction.type);
      setAmountText(
        formatEditableAmount(existingTransaction.amount, settings.currency),
      );
      setCategoryId(existingTransaction.categoryId);
      setDateText(existingTransaction.date);
      setNote(existingTransaction.note);
      setReceiptUri(existingTransaction.receiptUri);
      setErrors({});
    }
  }, [existingTransaction, settings.currency]);

  useEffect(() => {
    const draftUris = createdDraftUrisRef.current;
    return () => {
      if (didSaveRef.current) {
        return;
      }
      for (const draftUri of draftUris) {
        if (draftUri !== initialReceiptUriRef.current) {
          deleteReceiptImageQuietly(draftUri);
        }
      }
      draftUris.clear();
    };
  }, []);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      if (isNoteFocusedRef.current) {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, noteCardYRef.current - 24),
          animated: true,
        });
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const categoriesForType = useMemo(
    () => allCategories.filter((category) => category.type === type),
    [allCategories, type],
  );

  const today = todayIsoDate();
  const yesterday = shiftIsoDate(today, -1);
  const parsedDate = parseIsoDate(dateText.trim());

  const handleSelectType = useCallback(
    (nextType: TransactionType) => {
      if (nextType === type) {
        return;
      }
      setType(nextType);
      setCategoryId(null);
      setErrors((prev) => ({ ...prev, categoryId: undefined }));
    },
    [type],
  );

  const handleAmountChange = useCallback(
    (raw: string) => {
      setAmountText(formatInputAmount(raw, settings.currency));
      setErrors((prev) =>
        prev.amount !== undefined ? { ...prev, amount: undefined } : prev,
      );
    },
    [settings.currency],
  );

  const handleSelectCategory = useCallback((nextCategoryId: CategoryId) => {
    setCategoryId(nextCategoryId);
    setErrors((prev) =>
      prev.categoryId !== undefined ? { ...prev, categoryId: undefined } : prev,
    );
  }, []);

  const handleSetDate = useCallback((nextDate: string) => {
    setDateText(nextDate);
    setErrors((prev) =>
      prev.date !== undefined ? { ...prev, date: undefined } : prev,
    );
  }, []);

  const handleSelectQuickDate = useCallback(
    (nextDate: IsoDate) => {
      handleSetDate(nextDate);
      setCalendarOpen(false);
    },
    [handleSetDate],
  );

  const handleSelectCalendarDate = useCallback(
    (nextDate: IsoDate) => {
      handleSetDate(nextDate);
      setCalendarOpen(false);
    },
    [handleSetDate],
  );

  const handleToggleCalendar = useCallback(() => {
    Keyboard.dismiss();
    setCalendarOpen((prev) => !prev);
  }, []);

  const handleStepDay = useCallback(
    (deltaDays: number) => {
      const base = parseIsoDate(dateText.trim()) ?? todayIsoDate();
      handleSetDate(shiftIsoDate(base, deltaDays));
    },
    [dateText, handleSetDate],
  );

  const handleNoteChange = useCallback((text: string) => {
    setNote(text);
    setErrors((prev) =>
      prev.note !== undefined ? { ...prev, note: undefined } : prev,
    );
  }, []);

  const handleChangeReceiptUri = useCallback((nextUri: string | null) => {
    if (nextUri !== null && nextUri !== initialReceiptUriRef.current) {
      createdDraftUrisRef.current.add(nextUri);
    }
    setReceiptUri(nextUri);
    setErrors((prev) =>
      prev.receiptUri !== undefined
        ? { ...prev, receiptUri: undefined }
        : prev,
    );
  }, []);

  const handleSave = useCallback(() => {
    const draftResult = parseTransactionDraft(
      {
        ...(editTransactionId !== null ? { id: editTransactionId } : {}),
        type,
        amountText,
        categoryId,
        date: dateText,
        note,
        currency: settings.currency,
        receiptUri,
      },
      allCategories,
    );

    if (!draftResult.ok) {
      setErrors(draftResult.error);
      return;
    }

    const previousSavedUri =
      existingTransaction?.receiptUri ?? initialReceiptUriRef.current;
    const saved = store.saveTransaction(draftResult.value);
    didSaveRef.current = true;

    if (previousSavedUri !== null && previousSavedUri !== saved.receiptUri) {
      deleteReceiptImageQuietly(previousSavedUri);
    }
    for (const draftUri of createdDraftUrisRef.current) {
      if (draftUri !== saved.receiptUri) {
        deleteReceiptImageQuietly(draftUri);
      }
    }
    createdDraftUrisRef.current.clear();

    const savedMonth = isoDateToYearMonth(saved.date);
    if (savedMonth !== selectedMonth) {
      setSelectedMonth(savedMonth);
    }
    navigation.goBack();
  }, [
    allCategories,
    amountText,
    categoryId,
    dateText,
    editTransactionId,
    existingTransaction,
    navigation,
    note,
    receiptUri,
    selectedMonth,
    setSelectedMonth,
    settings.currency,
    store,
    type,
  ]);

  const handleDelete = useCallback(() => {
    if (existingTransaction === null) {
      return;
    }
    Alert.alert(
      'Delete transaction?',
      'This removes the transaction from your monthly totals.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            isDeletingRef.current = true;
            store.deleteTransaction(existingTransaction.id);
            deleteReceiptImageQuietly(existingTransaction.receiptUri);
            navigation.goBack();
          },
        },
      ],
    );
  }, [existingTransaction, navigation, store]);

  if (isEdit && existingTransaction === null) {
    if (isDeletingRef.current) {
      return (
        <View style={[styles.flex, { backgroundColor: theme.colors.canvas }]} />
      );
    }
    return (
      <View
        style={[
          styles.notFoundContainer,
          { backgroundColor: theme.colors.canvas },
        ]}
      >
        <Ionicons
          name="alert-circle-outline"
          size={36}
          color={theme.colors.textMuted}
        />
        <Text
          style={[
            theme.typography.sectionTitle,
            { color: theme.colors.text },
          ]}
        >
          Transaction not found
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          android_ripple={{ color: theme.colors.ripple }}
          style={[
            styles.notFoundButton,
            { backgroundColor: theme.colors.accent },
          ]}
          accessibilityRole="button"
        >
          <Text
            style={[
              theme.typography.bodyStrong,
              { color: theme.colors.onAccent },
            ]}
          >
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  const prefixLabel =
    currencyConfig.symbolPosition === 'prefix-space'
      ? `${currencyConfig.symbol} `
      : currencyConfig.symbol;
  const amountKeyboardType =
    currencyConfig.decimals === 0 ? 'number-pad' : 'decimal-pad';
  const polarityColor =
    type === 'expense' ? theme.colors.negative : theme.colors.positive;
  const amountCardBorderColor = errors.amount
    ? theme.colors.negative
    : isAmountFocused
      ? polarityColor
      : theme.colors.border;
  const amountCardBorderWidth = isAmountFocused || errors.amount ? 1.5 : 1;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.canvas }]}
      behavior="padding"
      keyboardVerticalOffset={insets.top + 56}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontalPadding },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <ScreenContainer style={styles.formColumn}>
          <SegmentedControl
            value={type}
            onChange={handleSelectType}
            options={typeOptions}
          />

          <Pressable
            onPress={() => amountInputRef.current?.focus()}
            accessible={false}
            style={[
              styles.amountCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: amountCardBorderColor,
                borderWidth: amountCardBorderWidth,
              },
            ]}
          >
            <Text
              style={[
                theme.typography.caption,
                styles.sectionLabel,
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
                  {
                    color: isAmountFocused
                      ? polarityColor
                      : theme.colors.textSecondary,
                  },
                ]}
              >
                {prefixLabel}
              </Text>
              <TextInput
                ref={amountInputRef}
                value={amountText}
                onChangeText={handleAmountChange}
                onFocus={() => setIsAmountFocused(true)}
                onBlur={() => setIsAmountFocused(false)}
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType={amountKeyboardType}
                style={[
                  theme.typography.display,
                  styles.amountInput,
                  { color: theme.colors.text },
                ]}
                returnKeyType="done"
                accessibilityLabel="Transaction amount"
              />
              {amountText.length > 0 ? (
                <Pressable
                  onPress={() => handleAmountChange('')}
                  android_ripple={{
                    color: theme.colors.ripple,
                    borderless: true,
                    radius: 24,
                  }}
                  style={({ pressed }) => [
                    styles.clearAmountButton,
                    Platform.OS !== 'android' &&
                      pressed && { backgroundColor: theme.colors.surfaceMuted },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Clear amount"
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
              ) : null}
            </View>
            {errors.amount ? (
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.negative },
                ]}
              >
                {getAmountErrorMessage(errors.amount)}
              </Text>
            ) : null}
          </Pressable>

          <View style={styles.sectionBlock}>
            <Text
              style={[
                theme.typography.caption,
                styles.sectionLabel,
                { color: theme.colors.textSecondary },
              ]}
            >
              Category
            </Text>
            <CategoryChipGrid
              categories={categoriesForType}
              selectedCategoryId={categoryId}
              onSelect={handleSelectCategory}
              error={
                errors.categoryId
                  ? getCategoryErrorMessage(errors.categoryId)
                  : undefined
              }
            />
          </View>

          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: errors.date
                  ? theme.colors.negative
                  : theme.colors.border,
              },
            ]}
          >
            <View style={styles.dateHeaderRow}>
              <Text
                style={[
                  theme.typography.caption,
                  styles.sectionLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Date
              </Text>
              <View style={styles.quickDateChips}>
                <Pressable
                  onPress={() => handleSelectQuickDate(today)}
                  android_ripple={{ color: theme.colors.ripple }}
                  style={[
                    styles.quickChip,
                    {
                      backgroundColor:
                        dateText === today
                          ? theme.colors.accentSoft
                          : theme.colors.surfaceMuted,
                      borderColor:
                        dateText === today
                          ? theme.colors.accent
                          : theme.colors.border,
                    },
                  ]}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityState={{ selected: dateText === today }}
                >
                  <Text
                    style={[
                      theme.typography.caption,
                      styles.quickChipText,
                      {
                        color:
                          dateText === today
                            ? theme.colors.accent
                            : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    Today
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleSelectQuickDate(yesterday)}
                  android_ripple={{ color: theme.colors.ripple }}
                  style={[
                    styles.quickChip,
                    {
                      backgroundColor:
                        dateText === yesterday
                          ? theme.colors.accentSoft
                          : theme.colors.surfaceMuted,
                      borderColor:
                        dateText === yesterday
                          ? theme.colors.accent
                          : theme.colors.border,
                    },
                  ]}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityState={{ selected: dateText === yesterday }}
                >
                  <Text
                    style={[
                      theme.typography.caption,
                      styles.quickChipText,
                      {
                        color:
                          dateText === yesterday
                            ? theme.colors.accent
                            : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    Yesterday
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.dateStepperRow}>
              <Pressable
                onPress={() => handleStepDay(-1)}
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
                accessibilityLabel="Previous day"
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={theme.colors.text}
                />
              </Pressable>

              <Pressable
                onPress={handleToggleCalendar}
                android_ripple={{ color: theme.colors.ripple }}
                style={({ pressed }) => [
                  styles.dateDisplayButton,
                  {
                    backgroundColor:
                      Platform.OS !== 'android' && pressed
                        ? theme.colors.surfaceMuted
                        : theme.colors.canvas,
                    borderColor: calendarOpen
                      ? theme.colors.accent
                      : theme.colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Toggle calendar date picker"
                accessibilityState={{ expanded: calendarOpen }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={
                    calendarOpen
                      ? theme.colors.accent
                      : theme.colors.textSecondary
                  }
                />
                <Text
                  style={[
                    theme.typography.bodyStrong,
                    styles.dateDisplayText,
                    { color: theme.colors.text },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {parsedDate ? formatFullDateLabel(parsedDate) : dateText}
                </Text>
                <Ionicons
                  name={calendarOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={
                    calendarOpen
                      ? theme.colors.accent
                      : theme.colors.textSecondary
                  }
                />
              </Pressable>

              <Pressable
                onPress={() => handleStepDay(1)}
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
                accessibilityLabel="Next day"
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.colors.text}
                />
              </Pressable>
            </View>

            <CalendarDropdown
              visible={calendarOpen}
              selectedDate={parsedDate ?? today}
              onSelectDate={handleSelectCalendarDate}
            />

            {errors.date ? (
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.negative },
                ]}
              >
                {getDateErrorMessage(errors.date)}
              </Text>
            ) : null}
          </View>

          <View
            onLayout={(event) => {
              noteCardYRef.current = event.nativeEvent.layout.y;
            }}
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: errors.note
                  ? theme.colors.negative
                  : theme.colors.border,
              },
            ]}
          >
            <View style={styles.noteHeader}>
              <Text
                style={[
                  theme.typography.caption,
                  styles.sectionLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Note
              </Text>
              {note.length > 140 ? (
                <Text
                  style={[
                    theme.typography.micro,
                    styles.charCounter,
                    {
                      color:
                        note.length > MAX_NOTE_LENGTH
                          ? theme.colors.negative
                          : theme.colors.textMuted,
                    },
                  ]}
                >
                  {`${note.length}/${MAX_NOTE_LENGTH}`}
                </Text>
              ) : null}
            </View>
            <TextInput
              value={note}
              onChangeText={handleNoteChange}
              onFocus={() => {
                isNoteFocusedRef.current = true;
                scrollViewRef.current?.scrollTo({
                  y: Math.max(0, noteCardYRef.current - 24),
                  animated: true,
                });
              }}
              onBlur={() => {
                isNoteFocusedRef.current = false;
              }}
              placeholder="Optional note (e.g. Lunch, Monthly internet)"
              placeholderTextColor={theme.colors.textMuted}
              maxLength={MAX_NOTE_LENGTH}
              returnKeyType="done"
              style={[
                theme.typography.body,
                styles.noteInput,
                { color: theme.colors.text },
              ]}
              accessibilityLabel="Transaction note"
            />
            {errors.note ? (
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.negative },
                ]}
              >
                {getNoteErrorMessage(errors.note)}
              </Text>
            ) : null}
          </View>

          <ReceiptPickerCard
            receiptUri={receiptUri}
            onChangeReceiptUri={handleChangeReceiptUri}
            error={
              errors.receiptUri
                ? getReceiptErrorMessage(errors.receiptUri)
                : undefined
            }
          />
        </ScreenContainer>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.divider,
            paddingHorizontal: horizontalPadding,
            paddingBottom: Math.max(insets.bottom, SPACING.md),
          },
        ]}
      >
        <ScreenContainer style={styles.bottomBarInner}>
          {isEdit ? (
            <Pressable
              onPress={handleDelete}
              android_ripple={{ color: theme.colors.ripple }}
              style={({ pressed }) => [
                styles.deleteActionButton,
                {
                  backgroundColor:
                    Platform.OS !== 'android' && pressed
                      ? theme.colors.negativeSoft
                      : theme.colors.surface,
                  borderColor: theme.colors.negative,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Delete transaction"
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={theme.colors.negative}
              />
              <Text
                style={[
                  theme.typography.bodyStrong,
                  { color: theme.colors.negative },
                ]}
              >
                Delete
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleSave}
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
              {isEdit ? 'Update' : 'Save'}
            </Text>
          </Pressable>
        </ScreenContainer>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  formColumn: {
    gap: SPACING.md,
  },
  amountCard: {
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    gap: SPACING.xs,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  currencyPrefix: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  amountInput: {
    flex: 1,
    fontSize: 40,
    lineHeight: 46,
    fontVariant: ['tabular-nums'],
    paddingVertical: 2,
  },
  clearAmountButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBlock: {
    gap: 6,
  },
  sectionCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: SPACING.sm,
  },
  sectionLabel: {
    fontWeight: '600',
  },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  quickDateChips: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  quickChip: {
    minHeight: 36,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipText: {
    fontWeight: '600',
  },
  dateStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  stepperButton: {
    width: 48,
    height: 48,
    minHeight: 48,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDisplayButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  dateDisplayText: {
    flexShrink: 1,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  charCounter: {
    fontVariant: ['tabular-nums'],
  },
  noteInput: {
    paddingVertical: SPACING.xs,
    minHeight: 36,
  },
  bottomBar: {
    paddingTop: SPACING.md,
    borderTopWidth: 1,
  },
  bottomBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteActionButton: {
    minHeight: 48,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    gap: SPACING.md,
  },
  notFoundButton: {
    marginTop: SPACING.xs,
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
