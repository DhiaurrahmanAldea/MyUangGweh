# MyUangGweh

Offline-first personal budgeting app built with Expo, React Native, TypeScript, and SQLite. Track monthly income and expenses, inspect spending by category, and keep all financial records stored locally on your device.

## Overview

### Core features

- **Transactions.** Add, edit, and delete income or expense entries with live currency formatting, category selection, an expandable calendar dropdown (`Today`, `Yesterday`, day stepper, or month grid), optional receipt photo proof from gallery or camera, and optional notes.
- **Monthly dashboard.** Month switcher, remaining balance card (green for surplus or balanced, red for deficit), total income and total expenses cards, income spent progress bar, category budget alerts, and recent transactions.
- **Transactions list.** Full monthly list grouped by date with daily net totals, Income, Expense, and category filters, and long-press delete reveal with a timed undo toast (plus Delete inside Edit transaction).
- **Categories.** Manage built-in default expense and income categories, switch between Expense and Income lists, add custom categories with curated icons and colors, rename or delete custom categories, and set optional monthly budget limits on expense categories.
- **Monthly reports.** Month-over-month expense comparison, SVG donut chart of spending by category, ranked category breakdown with percentage shares and budget status indicators, and tap-through filtering into the transactions list.
- **Interactive menu sliding.** Swipe horizontally anywhere across Home, Transactions, Reports, and Categories with native 1-to-1 horizontal paging (`Animated.ScrollView`) and a native-driver floating capsule pill in the bottom tab bar.

### Additional features

- **Monthly budget limits.** Optional per-category limits with alerts at 80% (`warning`), 100% (`reached`), and over budget (`exceeded`).
- **Recurring transactions.** Monthly rules (such as rent or salary) with month-end day clamping (for example, day 31 clamps to Feb 28 or Feb 29), active toggles, and idempotent automatic materialization.
- **Carry-over balance.** Toggleable setting to include net balance from prior months in the selected month's remaining balance.
- **Multi-currency formatting.** Support for `IDR` (default, formatted like `Rp 1.500.000`), `USD`, `EUR`, `SGD`, `GBP`, and `JPY`.
- **Dark mode.** Theme preference for `System`, `Light`, or `Dark`.
- **CSV export.** RFC-4180 compliant export using the native system share sheet.

## Project structure

```text
.
├── App.tsx                       App root, SafeAreaProvider, BudgetProvider, navigation theme
├── app.json                      Expo configuration (name, package IDs, plugins)
├── components/
│   ├── CalendarDropdown.tsx      Expandable month/day calendar selector
│   ├── CategoryChipGrid.tsx      Selectable category chip grid for forms
│   ├── CategoryEditorModal.tsx   Create and edit category modal form
│   ├── FloatingAddButton.tsx     Floating "+" action button
│   ├── MonthHeader.tsx           Month stepper header and settings shortcut
│   ├── ReceiptPickerCard.tsx     Gallery/camera receipt upload and full-screen preview
│   ├── RecurringRuleModal.tsx    New recurring transaction rule modal form
│   ├── ScreenContainer.tsx       Responsive centered max-width wrapper
│   ├── SegmentedControl.tsx      Shared accessible segmented tab control
│   ├── SpendingDonutChart.tsx    Responsive SVG donut chart for category spending
│   ├── SpentProgressBar.tsx      Monthly income-spent progress bar
│   ├── SummaryCardRow.tsx        Remaining balance, income, and expense summary cards
│   ├── TransactionRow.tsx        Transaction row with long-press delete reveal
│   └── UndoToast.tsx             Timed undo banner after transaction delete
├── db/
│   ├── BudgetProvider.tsx        SQLite provider and React hooks (useSyncExternalStore)
│   ├── parsers.ts                SQLite row boundary parsers
│   ├── schema.ts                 Schema DDL, constraints, and default categories
│   ├── seed.ts                   Dev-only sample data seeder and reset helper
│   ├── store.test.ts             SQLite integration tests (node:sqlite)
│   └── store.ts                  Synchronous SQLite store with revision-scoped caching
├── screens/
│   ├── CategoriesScreen.tsx      Category list, add/edit modal, budget limits, delete reassignment
│   ├── DashboardScreen.tsx       Monthly summary, budget alerts, recent transactions
│   ├── MainTabsContext.ts        Shared tab navigation context and useMainTabs hook
│   ├── MainTabsPager.tsx         Native horizontal paging menu slider and floating capsule tab bar
│   ├── ReportsScreen.tsx         Month-over-month comparison, donut chart, category breakdown
│   ├── RootNavigator.tsx         Root native stack hosting MainTabsPager, TransactionForm, and Settings
│   ├── SettingsScreen.tsx        Currency, carry-over, theme, recurring rules, CSV export, dev reset
│   ├── TransactionFormScreen.tsx Add/edit transaction form
│   └── TransactionsScreen.tsx    Date-grouped transaction list with filters and long-press delete
├── types/
│   ├── domain.ts                 Branded primitives, discriminated unions, input validation
│   └── navigation.ts             React Navigation parameter types
└── utils/
    ├── csv.ts                    RFC-4180 CSV serializer
    ├── date.ts                   Local calendar helpers, grid builder, and month clamping
    ├── money.test.ts             Unit tests for formatting, parsing, budgets, and summaries
    ├── money.ts                  Integer minor-unit calculations and summaries
    ├── receipt.ts                Local persistent receipt file storage helper
    └── theme.ts                  Light/dark palettes and color helpers
```

## Prerequisites and installation

- Node.js 22.5 or newer (required for the built-in `node:sqlite` module used by `npm test`)
- npm (included with Node.js)
- Expo Go app on Android or iOS for device testing, or an Android emulator / iOS Simulator

Install dependencies:

```bash
npm install
```

## Running on Expo Go

Start the Metro bundler:

```bash
npx expo start
```

Scan the QR code in Expo Go (Android) or the Camera app (iOS), or press `a` for Android emulator / `i` for iOS Simulator.

## Running type checks and tests

Run TypeScript static type checking:

```bash
npm run typecheck
```

Run unit and SQLite store integration tests:

```bash
npm test
```

## Building an Android APK

### Option 1: EAS Build (recommended)

1. Install the EAS CLI and sign in to your Expo account:

   ```bash
   npm install -g eas-cli
   eas login
   ```

2. Initialize EAS configuration if you have not already (`eas build:configure`), or create `eas.json` in the project root with a `preview` profile that builds an installable `.apk` instead of an `.aab`:

   ```json
   {
     "cli": {
       "version": ">= 16.0.0"
     },
     "build": {
       "preview": {
         "android": {
           "buildType": "apk"
         }
       },
       "production": {
         "android": {
           "buildType": "app-bundle"
         }
       }
     }
   }
   ```

3. Trigger the Android APK build:

   ```bash
   eas build -p android --profile preview
   ```

4. Once the build finishes, download the `.apk` from the link printed by EAS CLI and install it on an Android device.

### Option 2: Local Android prebuild

If you prefer building locally with Android Studio and the Android SDK installed:

```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

The release APK is written to `android/app/build/outputs/apk/release/app-release.apk` (configure release signing in `android/app/build.gradle` before distributing).

## Dev-only sample data

- On first launch in development mode (`__DEV__`), the database seeds two months of sample IDR transactions and two category budgets (`Food` and `Bills`) so the dashboard, transactions list, and monthly reports have data immediately.
- Seeding runs only when `dev_seeded = 0` and the `transactions` table is empty. It does not run in production builds.
- In dev mode, **Settings > Data & Export > Reset sample data** wipes current transactions, custom categories, recurring rules, and settings, then restores the baseline two-month sample data.

## Key assumptions

- **Default currency and integer storage.** `IDR` is the default currency (`0` decimals, formatted as `Rp 1.500.000`). All money values are stored in SQLite as integer minor units (`INTEGER`) to avoid floating-point rounding issues. Switching between 0-decimal currencies (`IDR`, `JPY`) and 2-decimal currencies (`USD`, `EUR`, `SGD`, `GBP`) updates display formatting and input rules without FX-converting existing stored numbers.
- **Offline-only storage.** All data stays locally on the device in `pocket_ledger.db` (`expo-sqlite`). There is no backend, authentication, or cloud sync.
- **Navigation.** Uses core React Native horizontal paging (`Animated.ScrollView` in `screens/MainTabsPager.tsx`) for native 1-to-1 sliding across `Home`, `Transactions`, `Reports`, and `Categories` with a native-driver floating capsule tab bar, hosted inside `@react-navigation/native-stack` alongside the `TransactionForm` modal and `Settings` screen.
- **Category protection and reassignment.** Default categories cannot be deleted or renamed (their icon, color, and expense budget limit can still be edited). Deleting a custom category atomically reassigns all linked transactions and recurring rules of that type to the built-in `Other` fallback category before removing the category.
- **CSV export format.** Exports all recorded transactions across months using RFC-4180 quoting (`Date,Type,Category,Amount,Note`) via `expo-file-system` and `expo-sharing`.
