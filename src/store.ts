import { useEffect, useState, useCallback } from 'react';
import type { AppState, MonthSnapshot, Subscription } from './types';
import { monthKey, monthDiff } from './utils';

const STORAGE_KEY = 'finance-app-state-v1';

const defaultState: AppState = {
  subscriptions: [],
  budget: [],
  imaginary: [],
  months: {},
  categories: ['Food', 'Internet', 'Rent', 'Utilities', 'Entertainment', 'Savings', 'Other'],
  primaryCurrency: 'CRC',
  exchangeRate: 510,
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
    appliedDates: [],
  },
};

const migrateImaginary = (arr: unknown): AppState['imaginary'] => {
  if (!Array.isArray(arr)) return [];
  return arr.map((e: Record<string, unknown>) => {
    if ('amount' in e && 'currency' in e) {
      return {
        id: e.id as string,
        personName: e.personName as string,
        amountCRC: e.currency === 'CRC' ? (e.amount as number) : 0,
        amountUSD: e.currency === 'USD' ? (e.amount as number) : 0,
        description: (e.description as string) || '',
        date: (e.date as string) || new Date().toISOString().slice(0, 10),
        collected: Boolean(e.collected),
      };
    }
    return e as unknown as AppState['imaginary'][number];
  });
};

const load = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      imaginary: migrateImaginary(parsed.imaginary),
    };
  } catch {
    return defaultState;
  }
};

export function useStore() {
  const [state, setState] = useState<AppState>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const update = useCallback((updater: (s: AppState) => AppState) => {
    setState((prev) => updater(prev));
  }, []);

  return { state, setState, update };
}

export function ensureMonth(state: AppState, key: string): AppState {
  if (state.months[key]) {
    return applySubscriptionsToMonth(state, key);
  }
  const fresh: MonthSnapshot = {
    monthKey: key,
    salary: { amount: 0, currency: state.primaryCurrency },
    bills: [],
  };
  const next: AppState = {
    ...state,
    months: { ...state.months, [key]: fresh },
  };
  return applySubscriptionsToMonth(next, key);
}

function isSubscriptionActiveForMonth(s: Subscription, key: string): boolean {
  if (!s.startMonth) return true;
  const diff = monthDiff(key, s.startMonth);
  if (diff < 0) return false;
  if (s.totalMonths !== undefined && diff >= s.totalMonths) return false;
  const freq = s.frequencyMonths ?? 1;
  return diff % freq === 0;
}

function applySubscriptionsToMonth(state: AppState, key: string): AppState {
  const month = state.months[key];
  if (!month) return state;
  const existingSubIds = new Set(
    month.bills.filter((b) => b.source === 'subscription').map((b) => b.subscriptionId)
  );
  const toAdd = state.subscriptions
    .filter((s) => s.active && !existingSubIds.has(s.id) && isSubscriptionActiveForMonth(s, key))
    .map((s) => ({
      id: `${s.id}-${key}`,
      name: s.name,
      amount: s.amount,
      currency: s.currency,
      category: s.category,
      source: 'subscription' as const,
      subscriptionId: s.id,
      creditCardId: s.creditCardId,
      accountId: s.accountId,
      paid: false,
    }));
  if (!toAdd.length) return state;
  return {
    ...state,
    months: {
      ...state.months,
      [key]: { ...month, bills: [...month.bills, ...toAdd] },
    },
  };
}

export const currentMonthKey = () => monthKey(new Date());

const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const effectiveDay = (day: number, year: number, month0: number) => {
  const dim = new Date(year, month0 + 1, 0).getDate();
  return Math.min(Math.max(1, day), dim);
};

/** Compute all schedule dates within [from, to] inclusive (both Date objects, time ignored). */
function scheduleDatesBetween(
  schedule: AppState['salarySchedule'],
  from: Date,
  to: Date
): string[] {
  const out: string[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  for (let cur = start; cur <= end; cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const d1 = new Date(y, m, effectiveDay(schedule.day1, y, m));
    if (d1 >= from && d1 <= to) out.push(toISODate(d1));
    if (schedule.cadence === 'biweekly' && schedule.day2) {
      const d2 = new Date(y, m, effectiveDay(schedule.day2, y, m));
      if (d2 >= from && d2 <= to) out.push(toISODate(d2));
    }
  }
  return out;
}

/** Pre-fill appliedDates with everything strictly before today so we don't retroactively apply. */
export function markPastAsApplied(
  schedule: AppState['salarySchedule'],
  today: Date = new Date()
): AppState['salarySchedule'] {
  const farPast = new Date(today.getFullYear() - 2, today.getMonth(), 1);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const past = scheduleDatesBetween(schedule, farPast, yesterday);
  return {
    ...schedule,
    appliedDates: Array.from(new Set([...schedule.appliedDates, ...past])),
  };
}

/** Apply any due salary deposits that haven't been applied yet. */
export function applyDueSalaries(state: AppState, today: Date = new Date()): AppState {
  const schedule = state.salarySchedule;
  if (!schedule.enabled || schedule.amount <= 0) return state;

  const lookback = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const due = scheduleDatesBetween(schedule, lookback, today);
  const applied = new Set(schedule.appliedDates);
  const toApply = due.filter((d) => !applied.has(d));
  if (toApply.length === 0) return state;

  let next = state;
  for (const iso of toApply) {
    const mKey = iso.slice(0, 7);
    next = ensureMonth(next, mKey);
    const m = next.months[mKey];

    let newSalary = m.salary;
    if (m.salary.amount === 0) {
      newSalary = { amount: schedule.amount, currency: schedule.currency };
    } else if (m.salary.currency === schedule.currency) {
      newSalary = { amount: m.salary.amount + schedule.amount, currency: schedule.currency };
    }

    next = {
      ...next,
      months: { ...next.months, [mKey]: { ...m, salary: newSalary } },
    };

    if (schedule.accountId) {
      const acc = next.accounts.find((a) => a.id === schedule.accountId);
      if (acc && acc.currency === schedule.currency) {
        next = {
          ...next,
          accounts: next.accounts.map((a) =>
            a.id === schedule.accountId ? { ...a, balance: a.balance + schedule.amount } : a
          ),
        };
      }
    }
  }

  return {
    ...next,
    salarySchedule: {
      ...schedule,
      appliedDates: Array.from(new Set([...schedule.appliedDates, ...toApply])),
    },
  };
}
