# Testing

Automated tests that guard the fundamental behavior of every view, so PRs can't silently
break existing functionality.

## Running

```sh
npm test         # run the whole suite once (what CI runs)
npm run test:watch  # watch mode while developing
```

The suite uses [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com)
under jsdom. Tests render the **whole app** (`<App />`) and drive it like a user: seed
localStorage, click through the bottom nav, fill forms, and assert on visible text.

## Layout (`src/test/`)

| File | Covers |
| --- | --- |
| `setup.ts` | jsdom shims (ResizeObserver, alert/confirm), localStorage reset per test |
| `fixtures.ts` | `emptyState()` (first-run defaults) and `seededState()` (data in every feature, with documented expected totals) |
| `helpers.tsx` | `renderApp`, tab navigation, scoped queries (`section`/`card`/`hero`/`entry`), locale-proof `money()` formatter |
| `app.test.tsx` | Shell: navigation, More sheet, month selector, localStorage persistence |
| `dashboard.test.tsx` | Remaining/hero math, stat cards, CC + imaginary + emergency toggles, nav cards |
| `accounts.test.tsx` | Add/edit/remove accounts, multi-currency totals |
| `bills.test.tsx` | Add bills (paid/unpaid), account deduction + refund, currency-mismatch guard, filters, subscriptions |
| `budget.test.tsx` | Salary allocations, reserves (percent/fixed) |
| `creditcards.test.tsx` | Manual + from-bills debt, payments, corrections |
| `imaginary.test.tsx` | Per-person grouping, collecting, outstanding totals |
| `analytics.test.tsx` | Cross-month totals, category and month filters |
| `settings.test.tsx` | Theme, language, currency, categories, salary schedule, JSON import |
| `store.test.ts` / `utils.test.ts` | Pure logic: subscriptions per month, salary schedule dates, conversions |

Every view is tested twice: with a **fresh empty account** and with a **seeded account**
(see the reference figures in `fixtures.ts`).

## Conventions

- Assert money via the `money()` helper, never hard-coded strings — number formatting is
  locale-dependent (`₡25,000` on CI, `₡25 000` elsewhere).
- Prefer real user flows through `<App />` over rendering components in isolation, so the
  wiring (store, month creation, cross-view effects) is covered too.
- The seeded fixture's expected totals are documented in `fixtures.ts`; if you change the
  fixture, update the math comment.

## CI gate for PRs

`.github/workflows/ci.yml` runs **lint → tests → typecheck/build** on every PR targeting
`main` (and on pushes to `main`).

To make it impossible to merge a failing PR, enable branch protection once in GitHub:
**Settings → Branches → Add branch ruleset** for `main` → enable
**Require status checks to pass** and select the **`checks`** job of the CI workflow.
