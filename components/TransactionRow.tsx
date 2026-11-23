import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import type {
  Category,
  CurrencyCode,
  Transaction,
  TransactionId,
} from '../types/domain';
import { formatSectionDateLabel } from '../utils/date';
import { formatMoney } from '../utils/money';
import { colorWithAlpha, useAppTheme, useReduceMotion } from '../utils/theme';

export interface TransactionRowProps {
  readonly transaction: Transaction;
  readonly category: Category | undefined;
  readonly currency: CurrencyCode;
  readonly onPress: (transaction: Transaction) => void;
  readonly onSwipeDelete?: (transaction: Transaction) => void;
  readonly isDeleteOpen?: boolean;
  readonly onToggleDeleteOpen?: (transactionId: TransactionId | null) => void;
  readonly showDate?: boolean;
  readonly showDivider?: boolean;
}

const SNAP_OPEN_OFFSET_X = -88;
const LONG_PRESS_DELAY_MS = 320;

export function TransactionRow({
  transaction,
  category,
  currency,
  onPress,
  onSwipeDelete,
  isDeleteOpen,
  onToggleDeleteOpen,
  showDate = false,
  showDivider = false,
}: TransactionRowProps) {
  const theme = useAppTheme();
  const reduceMotion = useReduceMotion();
  const translateX = useRef(new Animated.Value(0)).current;
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = isDeleteOpen !== undefined;
  const isOpen =
    onSwipeDelete !== undefined && (isControlled ? isDeleteOpen : internalOpen);

  const prevTransactionIdRef = useRef(transaction.id);
  const prevIsOpenRef = useRef(isOpen);

  useEffect(() => {
    const idChanged = prevTransactionIdRef.current !== transaction.id;
    prevTransactionIdRef.current = transaction.id;

    if (idChanged) {
      prevIsOpenRef.current = isOpen;
      if (!isControlled) {
        setInternalOpen(false);
      }
      translateX.stopAnimation();
      translateX.setValue(isOpen ? SNAP_OPEN_OFFSET_X : 0);
      return;
    }

    if (prevIsOpenRef.current === isOpen) {
      return;
    }
    prevIsOpenRef.current = isOpen;

    const target = isOpen ? SNAP_OPEN_OFFSET_X : 0;
    if (reduceMotion) {
      translateX.stopAnimation();
      translateX.setValue(target);
      return;
    }

    const animation = Animated.spring(translateX, {
      toValue: target,
      useNativeDriver: true,
      damping: 22,
      stiffness: 260,
      mass: 0.9,
    });
    animation.start();

    return () => {
      animation.stop();
    };
  }, [isControlled, isOpen, reduceMotion, transaction.id, translateX]);

  const setRowOpen = useCallback(
    (nextOpen: boolean) => {
      if (onToggleDeleteOpen !== undefined) {
        onToggleDeleteOpen(nextOpen ? transaction.id : null);
      }
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }
    },
    [isControlled, onToggleDeleteOpen, transaction.id],
  );

  const handleRowPress = useCallback(() => {
    if (isOpen) {
      setRowOpen(false);
      return;
    }
    onPress(transaction);
  }, [isOpen, onPress, setRowOpen, transaction]);

  const handleRowLongPress = useCallback(() => {
    if (onSwipeDelete === undefined) {
      return;
    }
    setRowOpen(!isOpen);
  }, [isOpen, onSwipeDelete, setRowOpen]);

  const handleDeletePress = useCallback(() => {
    setRowOpen(false);
    onSwipeDelete?.(transaction);
  }, [onSwipeDelete, setRowOpen, transaction]);

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'delete') {
        setRowOpen(false);
        onSwipeDelete?.(transaction);
      }
    },
    [onSwipeDelete, setRowOpen, transaction],
  );

  const deleteCueOpacity = translateX.interpolate({
    inputRange: [SNAP_OPEN_OFFSET_X, -28, 0],
    outputRange: [1, 0.35, 0],
    extrapolate: 'clamp',
  });

  const deleteCueScale = reduceMotion
    ? 1
    : translateX.interpolate({
        inputRange: [SNAP_OPEN_OFFSET_X, -24, 0],
        outputRange: [1, 0.82, 0.72],
        extrapolate: 'clamp',
      });

  const categoryName = category?.name ?? 'Other';
  const categoryIcon = category?.icon ?? 'ellipsis-horizontal-circle-outline';
  const categoryColor = category?.color ?? theme.colors.textMuted;
  const iconBadgeBg = colorWithAlpha(categoryColor, theme.isDark ? 0.22 : 0.13);

  const isIncome = transaction.type === 'income';
  const formattedAmount = isIncome
    ? formatMoney(transaction.amount, currency, { showSign: true })
    : `-${formatMoney(transaction.amount, currency)}`;
  const amountColor = isIncome ? theme.colors.positive : theme.colors.text;

  const hasReceipt = transaction.receiptUri !== null;
  const trimmedNote = transaction.note.trim();
  const datePart = showDate ? formatSectionDateLabel(transaction.date) : '';
  const subtitle =
    datePart && trimmedNote
      ? `${datePart} · ${trimmedNote}`
      : datePart || trimmedNote;
  const rowAccessibilityLabel = `${categoryName} ${formattedAmount}${subtitle ? `, ${subtitle}` : ''}${hasReceipt ? ', receipt attached' : ''}`;

  const rowContent = (
    <Pressable
      onPress={handleRowPress}
      onLongPress={onSwipeDelete ? handleRowLongPress : undefined}
      delayLongPress={onSwipeDelete ? LONG_PRESS_DELAY_MS : undefined}
      android_ripple={{ color: theme.colors.ripple }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor:
            Platform.OS !== 'android' && pressed
              ? theme.colors.surfaceMuted
              : theme.colors.surface,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={rowAccessibilityLabel}
      accessibilityHint={
        onSwipeDelete ? 'Long press to reveal delete action' : undefined
      }
      accessibilityActions={
        onSwipeDelete
          ? [{ name: 'delete', label: 'Delete transaction' }]
          : undefined
      }
      onAccessibilityAction={
        onSwipeDelete ? handleAccessibilityAction : undefined
      }
    >
      <View style={[styles.iconBadge, { backgroundColor: iconBadgeBg }]}>
        <Ionicons name={categoryIcon} size={20} color={categoryColor} />
      </View>

      <View style={styles.textColumn}>
        <View style={styles.titleRow}>
          <Text
            style={[
              theme.typography.bodyStrong,
              styles.categoryName,
              { color: theme.colors.text },
            ]}
            numberOfLines={1}
          >
            {categoryName}
          </Text>
          {transaction.recurringRuleId !== null ? (
            <Ionicons
              name="repeat-outline"
              size={13}
              color={theme.colors.textMuted}
            />
          ) : null}
          {hasReceipt ? (
            <Ionicons
              name="document-attach-outline"
              size={13}
              color={theme.colors.accent}
            />
          ) : null}
        </View>
        {subtitle ? (
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <Text
        style={[
          theme.typography.bodyStrong,
          styles.amount,
          { color: amountColor },
        ]}
        numberOfLines={1}
      >
        {formattedAmount}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.outerWrapper}>
      {onSwipeDelete !== undefined ? (
        <View style={styles.swipeContainer}>
          <View
            pointerEvents={isOpen ? 'auto' : 'none'}
            accessibilityElementsHidden={!isOpen}
            style={[
              styles.deleteBackdrop,
              { backgroundColor: theme.colors.destructiveFill },
            ]}
          >
            <Pressable
              onPress={handleDeletePress}
              android_ripple={{
                color: colorWithAlpha(theme.colors.onDestructive, 0.2),
              }}
              style={styles.deleteButton}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${categoryName} transaction`}
              importantForAccessibility={isOpen ? 'yes' : 'no-hide-descendants'}
            >
              <Animated.View
                style={[
                  styles.deleteCueContent,
                  {
                    opacity: deleteCueOpacity,
                    transform: [{ scale: deleteCueScale }],
                  },
                ]}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={theme.colors.onDestructive}
                />
                <Text
                  style={[
                    theme.typography.caption,
                    styles.deleteButtonText,
                    { color: theme.colors.onDestructive },
                  ]}
                >
                  Delete
                </Text>
              </Animated.View>
            </Pressable>
          </View>

          <Animated.View style={{ transform: [{ translateX }] }}>
            {rowContent}
          </Animated.View>
        </View>
      ) : (
        rowContent
      )}

      {showDivider ? (
        <View
          style={[
            styles.divider,
            { backgroundColor: theme.colors.divider },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    overflow: 'hidden',
  },
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  deleteBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  deleteButton: {
    width: Math.abs(SNAP_OPEN_OFFSET_X),
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCueContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  deleteButtonText: {
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    minHeight: 60,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  categoryName: {
    flexShrink: 1,
  },
  amount: {
    fontVariant: ['tabular-nums'],
    marginLeft: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
});
