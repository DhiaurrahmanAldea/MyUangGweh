import { createContext, useContext } from 'react';
import type {
  MainTabKey,
  PendingTransactionsFilter,
  TransactionsTabFilter,
} from '../types/navigation';

export interface MainTabsContextValue {
  readonly activeTab: MainTabKey;
  readonly switchTab: (
    tab: MainTabKey,
    filter?: TransactionsTabFilter,
  ) => void;
  readonly pendingTransactionsFilter: PendingTransactionsFilter | null;
  readonly clearPendingTransactionsFilter: () => void;
}

export const MainTabsContext = createContext<MainTabsContextValue | null>(null);

export function useMainTabs(): MainTabsContextValue {
  const context = useContext(MainTabsContext);
  if (context === null) {
    throw new Error('useMainTabs must be used inside <MainTabsPager>');
  }
  return context;
}
