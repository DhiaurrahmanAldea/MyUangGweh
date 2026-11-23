import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import type { RootStackParamList } from '../types/navigation';
import { useAppTheme, useReduceMotion } from '../utils/theme';
import { MainTabsPager } from './MainTabsPager';
import { SettingsScreen } from './SettingsScreen';
import { TransactionFormScreen } from './TransactionFormScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const theme = useAppTheme();
  const reduceMotion = useReduceMotion();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.text,
        contentStyle: {
          backgroundColor: theme.colors.canvas,
        },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabsPager}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TransactionForm"
        component={TransactionFormScreen}
        options={({ route, navigation }) => ({
          presentation: 'modal',
          animation: reduceMotion ? 'none' : 'slide_from_bottom',
          headerBackVisible: false,
          title:
            route.params.mode === 'edit'
              ? 'Edit transaction'
              : 'Add transaction',
          headerLeft: () => (
            <Pressable
              onPress={() => navigation.goBack()}
              android_ripple={{
                color: theme.colors.ripple,
                borderless: true,
                radius: 24,
              }}
              style={({ pressed }) => [
                styles.headerCloseButton,
                Platform.OS !== 'android' &&
                  pressed && { backgroundColor: theme.colors.surfaceMuted },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          animation: reduceMotion ? 'none' : 'slide_from_right',
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  headerCloseButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
