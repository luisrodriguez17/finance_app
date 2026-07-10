import { describe, expect, it } from 'vitest';
import { applyDueSalaries, ensureMonth, markPastAsApplied } from '../store';
import type { AppState, Subscription } from '../types';
import { emptyState } from './fixtures';

const sub = (over: Partial<Subscription>): Subscription => ({
  id: 'sub-1',
  name: 'Netflix',
  amount: 15,
  currency: 'USD',
  category: 'Entertainment',
  active: true,
  ...over,
});

describe('ensureMonth', () => {
  it('creates a fresh month with zero salary and no bills', () => {
    const next = ensureMonth(emptyState(), '2026-05');
    expect(next.months['2026-05']).toEqual({
      monthKey: '2026-05',
      salary: { amount: 0, currency: 'CRC' },
      bills: [],
    });
  });

  it('applies active subscriptions as bills, exactly once', () => {
    let s: AppState = { ...emptyState(), subscriptions: [sub({ startMonth: '2026-01' })] };
    s = ensureMonth(s, '2026-03');
    s = ensureMonth(s, '2026-03');

    const bills = s.months['2026-03'].bills;
    expect(bills).toHaveLength(1);
    expect(bills[0]).toMatchObject({
      name: 'Netflix',
      source: 'subscription',
      subscriptionId: 'sub-1',
      paid: false,
    });
  });

  it('skips inactive subscriptions and months before startMonth', () => {
    const s: AppState = {
      ...emptyState(),
      subscriptions: [
        sub({ id: 'off', active: false }),
        sub({ id: 'later', startMonth: '2026-06' }),
      ],
    };
    expect(ensureMonth(s, '2026-05').months['2026-05'].bills).toHaveLength(0);
  });

  it('honors frequencyMonths (quarterly only lands every third month)', () => {
    const s: AppState = {
      ...emptyState(),
      subscriptions: [sub({ startMonth: '2026-01', frequencyMonths: 3 })],
    };
    expect(ensureMonth(s, '2026-01').months['2026-01'].bills).toHaveLength(1);
    expect(ensureMonth(s, '2026-02').months['2026-02'].bills).toHaveLength(0);
    expect(ensureMonth(s, '2026-04').months['2026-04'].bills).toHaveLength(1);
  });

  it('honors totalMonths (subscription expires after its run)', () => {
    const s: AppState = {
      ...emptyState(),
      subscriptions: [sub({ startMonth: '2026-01', totalMonths: 2 })],
    };
    expect(ensureMonth(s, '2026-02').months['2026-02'].bills).toHaveLength(1);
    expect(ensureMonth(s, '2026-03').months['2026-03'].bills).toHaveLength(0);
  });
});

describe('markPastAsApplied', () => {
  it('records every schedule date strictly before today', () => {
    const schedule = { ...emptyState().salarySchedule, enabled: true, amount: 1000, day1: 15 };
    const marked = markPastAsApplied(schedule, new Date(2026, 6, 10)); // Jul 10 2026

    expect(marked.appliedDates).toContain('2026-06-15');
    expect(marked.appliedDates).toContain('2024-07-15'); // two-year lookback
    expect(marked.appliedDates).not.toContain('2026-07-15'); // still in the future
  });
});

describe('applyDueSalaries', () => {
  const base = (over: Partial<AppState['salarySchedule']>): AppState => ({
    ...emptyState(),
    accounts: [{ id: 'acc-1', name: 'Main', balance: 0, currency: 'CRC' }],
    salarySchedule: {
      ...emptyState().salarySchedule,
      enabled: true,
      amount: 100000,
      currency: 'CRC',
      day1: 15,
      ...over,
    },
  });

  it('does nothing when disabled', () => {
    const s = base({ enabled: false });
    expect(applyDueSalaries(s, new Date(2026, 6, 20))).toBe(s);
  });

  it('applies unapplied due dates to month salary and the linked account', () => {
    const next = applyDueSalaries(base({ accountId: 'acc-1' }), new Date(2026, 6, 20));

    expect(next.months['2026-06'].salary).toEqual({ amount: 100000, currency: 'CRC' });
    expect(next.months['2026-07'].salary).toEqual({ amount: 100000, currency: 'CRC' });
    expect(next.accounts[0].balance).toBe(200000); // June 15 + July 15
    expect(next.salarySchedule.appliedDates).toEqual(
      expect.arrayContaining(['2026-06-15', '2026-07-15'])
    );
  });

  it('is idempotent: a second run on the same day changes nothing', () => {
    const once = applyDueSalaries(base({}), new Date(2026, 6, 20));
    const twice = applyDueSalaries(once, new Date(2026, 6, 20));
    expect(twice).toBe(once);
  });

  it('credits the month AFTER the paycheck date when fundsNextMonth is set', () => {
    const s = base({ fundsNextMonth: true, day1: 28, appliedDates: ['2026-05-28'] });
    const next = applyDueSalaries(s, new Date(2026, 5, 30)); // Jun 30 2026

    expect(next.months['2026-07'].salary).toEqual({ amount: 100000, currency: 'CRC' });
    expect(next.months['2026-06']).toBeUndefined();
  });

  it('treats day 31 as the last day of shorter months', () => {
    const s = base({ day1: 31, appliedDates: [] });
    const next = applyDueSalaries(s, new Date(2026, 2, 5)); // Mar 5 2026
    expect(next.salarySchedule.appliedDates).toContain('2026-02-28');
  });

  it('leaves the account untouched when its currency differs from the salary', () => {
    const s: AppState = {
      ...base({ accountId: 'acc-usd', appliedDates: ['2026-06-15'] }),
      accounts: [{ id: 'acc-usd', name: 'USD acct', balance: 100, currency: 'USD' }],
    };
    const next = applyDueSalaries(s, new Date(2026, 6, 20));

    expect(next.months['2026-07'].salary.amount).toBe(100000);
    expect(next.accounts[0].balance).toBe(100);
  });

  it('does not overwrite an existing salary in a different currency', () => {
    let s = base({ appliedDates: ['2026-06-15'] });
    s = {
      ...s,
      months: {
        '2026-07': {
          monthKey: '2026-07',
          salary: { amount: 500, currency: 'USD' },
          bills: [],
        },
      },
    };
    const next = applyDueSalaries(s, new Date(2026, 6, 20));

    expect(next.months['2026-07'].salary).toEqual({ amount: 500, currency: 'USD' });
    expect(next.salarySchedule.appliedDates).toContain('2026-07-15');
  });
});
