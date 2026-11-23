import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import type { CategoryId, TransactionId, TransactionType } from './domain';

export const MAIN_TABS = [
  'Dashboard',
  'Transactions',
  'Reports',
  'Categories',
] as const;

export type MainTabKey = (typeof MAIN_TABS)[number];

export interface TransactionsTabFilter {
  readonly filterType?: TransactionType;
  readonly categoryId?: CategoryId;
}

export interface PendingTransactionsFilter extends TransactionsTabFilter {
  readonly nonce: number;
}

export type TransactionFormParams =
  | { readonly mode: 'create'; readonly initialType?: TransactionType }
  | { readonly mode: 'edit'; readonly transactionId: TransactionId };

export type RootStackParamList = {
  MainTabs: undefined;
  TransactionForm: TransactionFormParams;
  Settings: undefined;
};

export type RootStackNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
