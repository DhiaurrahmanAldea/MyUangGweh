import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  colorWithAlpha,
  useAppTheme,
  useReduceMotion,
  useResponsiveLayout,
} from '../utils/theme';

export interface UndoToastProps {
  readonly visible: boolean;
  readonly message: string;
  readonly onUndo: () => void;
  readonly onDismiss: () => void;
  readonly durationMs?: number;
  readonly bottomOffset?: number;
  readonly toastKey?: string | number;
}

const TOAST_MAX_WIDTH = 640;

export function UndoToast({
  visible,
  message,
  onUndo,
  onDismiss,
  durationMs = 4000,
  bottomOffset = 20,
  toastKey,
}: UndoToastProps) {
  const theme = useAppTheme();
  const reduceMotion = useReduceMotion();
  const { horizontalPadding } = useResponsiveLayout();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }
    const timer = setTimeout(() => {
      onDismiss();
    }, durationMs);

    return () => {
      clearTimeout(timer);
    };
  }, [visible, durationMs, onDismiss, message, toastKey]);

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      translateY.setValue(reduceMotion ? 0 : 8);
      return;
    }

    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(8);
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
  }, [visible, toastKey, reduceMotion, opacity, translateY]);

  if (!visible) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        {
          bottom: bottomOffset,
          left: horizontalPadding,
          right: horizontalPadding,
        },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.toast,
          theme.shadows.floating,
          {
            backgroundColor: theme.colors.toastSurface,
            borderColor: theme.colors.toastBorder,
            opacity,
            transform: [{ translateY }],
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        <Text
          style={[
            theme.typography.body,
            styles.message,
            { color: theme.colors.toastText },
          ]}
          numberOfLines={1}
        >
          {message}
        </Text>

        <Pressable
          onPress={onUndo}
          android_ripple={{ color: colorWithAlpha(theme.colors.toastAction, 0.2) }}
          style={({ pressed }) => [
            styles.undoButton,
            { borderRadius: theme.radius.sm },
            Platform.OS !== 'android' && pressed && styles.undoButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Undo"
          hitSlop={4}
        >
          <Text
            style={[
              theme.typography.bodyStrong,
              { color: theme.colors.toastAction },
            ]}
          >
            Undo
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 20,
  },
  toast: {
    width: '100%',
    maxWidth: TOAST_MAX_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 4,
    minHeight: 48,
  },
  message: {
    flex: 1,
    marginRight: 8,
  },
  undoButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  undoButtonPressed: {
    opacity: 0.7,
  },
});
