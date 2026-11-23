# Task: Build a mobile budgeting app

## Goal
Build a simple, fast mobile app that lets me track my income, my expenses, and
see exactly how much money I have left each month.

## Tech stack
- React Native with Expo (TypeScript), so it runs on both Android and iOS
- Local storage using SQLite (expo-sqlite) so it works fully offline
- No login, no backend, no cloud: all data stays on the device
- Navigation: Expo Router or React Navigation (bottom tabs)

## Core features (must have)
1. **Add transactions**
   - Type: Income or Expense
   - Amount, category, date (default: today), optional note
   - Edit and delete existing transactions
2. **Monthly dashboard (home screen)**
   - Month selector (previous / next month arrows)
   - Three summary cards: Total Income, Total Expenses, Remaining Balance
     (Remaining = Income - Expenses)
   - Remaining Balance is green when positive and red when negative
   - A progress bar showing the percentage of income spent
   - Recent transactions list for the selected month
3. **Transactions screen**
   - Full list for the selected month, grouped by date
   - Filter by Income / Expense / category
   - Swipe to delete
4. **Categories**
   - Default expense categories: Food, Transport, Bills, Shopping, Health,
     Entertainment, Other
   - Default income categories: Salary, Business, Gift, Other
   - Let me add, rename, and delete custom categories
5. **Monthly report**
   - Pie or bar chart of spending by category for the selected month
   - Comparison with the previous month (higher or lower, and by how much)

## Nice to have (only after the core works)
- Optional monthly budget limit per category, with a warning at 80% and 100%
- Recurring transactions (e.g., monthly rent or salary)
- Carry over remaining balance to the next month (toggle)
- Export transactions to CSV
- Dark mode
- Currency setting (default: IDR, format like "Rp 1.500.000")

## Data model
- `transactions`: id, type ('income' | 'expense'), amount (integer, smallest
  currency unit), category_id, date (ISO string), note, created_at
- `categories`: id, name, type ('income' | 'expense'), icon, color, is_default
- `settings`: currency, carry_over_enabled

## UX requirements
- Adding a transaction should take no more than 3 taps and a number entry
- Large "+" floating button on the dashboard and transactions screens
- Numeric keypad opens automatically for the amount field
- Validate input: amount must be greater than 0, a category is required
- Clean, minimal design with a consistent color palette
- Support small and large screen sizes

## Code quality
- Organize the project into clear folders: `/screens`, `/components`,
  `/db`, `/utils`, `/types`
- Keep all money calculations in one utility file with unit tests
  (total income, total expenses, remaining balance, monthly grouping)
- Store money as integers to avoid floating-point errors
- Comment the non-obvious logic only; keep the code readable

## How to work
1. First, briefly outline your plan and the file structure, then start building.
2. Build in this order: database setup -> add/edit transaction -> dashboard
   calculations -> transactions list -> categories -> reports.
3. After each step, make sure the app runs without errors before moving on.
4. Seed the app with sample data in a dev-only mode so I can test the
   dashboard right away.
5. If any requirement is ambiguous, choose the simplest sensible option and
   note your assumption instead of stopping to ask.

## Definition of done
- I can add income and expenses, and the dashboard updates instantly
- Switching months shows the correct totals and remaining balance for that month
- Data persists after closing and reopening the app
- Deleting or editing a transaction updates all totals correctly
- The app runs on Expo Go with `npx expo start` and no errors
- A README explains how to install, run, and build an APK