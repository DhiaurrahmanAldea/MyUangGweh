import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BudgetProvider } from './db/BudgetProvider';
import { RootNavigator } from './screens/RootNavigator';
import { toNavigationTheme, useAppTheme } from './utils/theme';

function ThemedAppShell() {
  const theme = useAppTheme();

  return (
    <NavigationContainer theme={toNavigationTheme(theme)}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <BudgetProvider>
        <ThemedAppShell />
      </BudgetProvider>
    </SafeAreaProvider>
  );
}
