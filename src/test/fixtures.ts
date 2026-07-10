import type { AppState } from '../types';
import { currentMonthKey } from '../store';
import { monthKey } from '../utils';

/** The month the app opens on (tests run against the real current date). */
export const CUR = currentMonthKey();

/** The month immediately before CUR. */
export const PREV = (() => {
  const [y, m] = CUR.split('-').map(Number);
  return monthKey(new Date(y, m - 2, 1));
})();

/** Round exchange rate so every expected amount is an exact integer. */
export const RATE = 500;

/**
 * Mirrors the app's default (first-run) state. Kept as an explicit object so a
 * default change on main that would break users' stored data also breaks a test.
 */
export function emptyState(): AppState {
  return {
    subscriptions: [],
    budget: [],
    imaginary: [],
    months: {},
    categories: ['Food', 'Internet', 'Rent', 'Utilities', 'Entertainment', 'Savings', 'Other'],
    primaryCurrency: 'CRC',
    exchangeRate: RATE,
    accounts: [],
    creditCards: [],
    includeCreditCardInBills: false,
    includeImaginaryInDashboard: false,
    reserves: [],
    language: 'en',
    theme: 'dark',
    salarySchedule: {
      enabled: false,
      amount: 0,
      currency: 'CRC',
      cadence: 'monthly',
      day1: 15,
      day2: undefined,
      accountId: undefined,
      fundsNextMonth: false,
      appliedDates: [],
    },
  };
}

/**
 * A realistic account with data across every feature. Bill names deliberately
 * differ from category names so text queries are unambiguous.
 *
 * Reference figures (RATE = 500, primary CRC):
 * - Account balances: ₡500,000 + $1,000  → combined ₡1,000,000
 * - Reserves: 10% of CRC balance = ₡50,000; fixed $200
 * - Current-month direct bills (no card, not settled): ₡200,000 (rent) + $15 (Netflix)
 * - Card debt: the owed totals ₡100,000 + $50. The ₡30,000 Amazon bill sits on the
 *   card but is unpaid, so it hasn't charged the card yet (transactional card debt).
 * - Pending imaginary: ₡20,000 + $5 (Alice); Bob is fully collected
 * - Dashboard remaining: CRC 500,000−50,000−200,000 = ₡250,000; USD 1,000−200−15 = $785
 *   → combined ₡642,500
 */
export function seededState(): AppState {
  return {
    ...emptyState(),
    accounts: [
      { id: 'acc-crc', name: 'BAC Checking', balance: 500000, currency: 'CRC' },
      { id: 'acc-usd', name: 'US Savings', balance: 1000, currency: 'USD' },
    ],
    creditCards: [{ id: 'card-1', name: 'Visa', owedCRC: 100000, owedUSD: 50 }],
    subscriptions: [
      {
        id: 'sub-net',
        name: 'Netflix',
        amount: 15,
        currency: 'USD',
        category: 'Entertainment',
        active: true,
        startMonth: CUR,
      },
    ],
    budget: [
      { id: 'slice-1', name: 'Needs', percentage: 50 },
      { id: 'slice-2', name: 'Savings', percentage: 20 },
    ],
    reserves: [
      { id: 'res-1', name: 'Emergency', mode: 'percent', value: 10, currency: 'CRC' },
      { id: 'res-2', name: 'Trip', mode: 'fixed', value: 200, currency: 'USD' },
    ],
    imaginary: [
      {
        id: 'img-1',
        personName: 'Alice',
        amountCRC: 20000,
        amountUSD: 0,
        description: 'Lunch',
        date: '2026-01-10',
        collected: false,
      },
      {
        id: 'img-2',
        personName: 'Alice',
        amountCRC: 0,
        amountUSD: 5,
        description: 'Movie',
        date: '2026-02-01',
        collected: false,
      },
      {
        id: 'img-3',
        personName: 'Bob',
        amountCRC: 10000,
        amountUSD: 0,
        description: 'Loan',
        date: '2026-01-05',
        collected: true,
      },
    ],
    months: {
      [PREV]: {
        monthKey: PREV,
        salary: { amount: 800000, currency: 'CRC' },
        bills: [
          {
            id: 'bill-food',
            name: 'Groceries',
            amount: 50000,
            currency: 'CRC',
            category: 'Food',
            source: 'manual',
            paid: true,
          },
        ],
      },
      [CUR]: {
        monthKey: CUR,
        salary: { amount: 800000, currency: 'CRC' },
        bills: [
          {
            id: 'bill-rent',
            name: 'Apartment',
            amount: 200000,
            currency: 'CRC',
            category: 'Rent',
            source: 'manual',
            paid: false,
          },
          {
            id: 'bill-net',
            name: 'Fiber',
            amount: 25000,
            currency: 'CRC',
            category: 'Internet',
            source: 'manual',
            accountId: 'acc-crc',
            paid: true,
            settledFrom: { accountId: 'acc-crc', amount: 25000, currency: 'CRC' },
          },
          {
            // The bill the Netflix subscription generates for CUR; included so
            // ensureMonth() on app load doesn't add a duplicate.
            id: `sub-net-${CUR}`,
            name: 'Netflix',
            amount: 15,
            currency: 'USD',
            category: 'Entertainment',
            source: 'subscription',
            subscriptionId: 'sub-net',
            paid: false,
          },
          {
            id: 'bill-card',
            name: 'Amazon',
            amount: 30000,
            currency: 'CRC',
            category: 'Other',
            source: 'manual',
            creditCardId: 'card-1',
            paid: false,
          },
        ],
      },
    },
  };
}
