import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useResponsiveLayout } from '../utils/theme';

export interface ScreenContainerProps {
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly maxWidth?: number;
}

export function ScreenContainer({
  children,
  style,
  maxWidth,
}: ScreenContainerProps) {
  const { contentMaxWidth } = useResponsiveLayout();

  return (
    <View
      style={[
        styles.container,
        { maxWidth: maxWidth ?? contentMaxWidth },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
  },
});
