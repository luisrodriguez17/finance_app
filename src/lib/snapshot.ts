/**
 * Builds the compact financial snapshot sent to the assistant.
 *
 * The user's data never leaves the device unencrypted except for this
 * snapshot: pre-aggregated totals, monthly averages, and linear projections
 * that the LLM needs to answer questions. Raw state (every bill, every
 * transaction) is NOT sent — only names and rounded aggregates.
 */
import type { AppState, Currency } from '../types';
import { convert, monthKey, computeReserve } from '../utils';

export interface AssistantSnapshot {
  today: string;
  primaryCurrency: Currency;
  exchangeRateCrcPerUsd: number;
  /** Valid bill/subscription categories (for proposed actions). */
  categories: string[];
  accounts: { name: string; balance: number; currency: Currency }[];
  totalBalanceInPrimary: number;
  creditCards: { name: string; debtCRC: number; debtUSD: number }[];
  totalCardDebtInPrimary: number;
  reservedSavingsInPrimary: number;
  moneyOwedToUserInPrimary: number;
  subscriptions: { name: string; monthlyCostInPrimary: number }[];
  recurringMonthlyCommitmentInPrimary: number;
  currentMonth: {
    month: string;
    salaryInPrimary: number;
    billsTotalInPrimary: number;
    billsPaidInPrimary: number;
    billsUnpaidInPrimary: number;
    byCategoryInPrimary: Record<string, number>;
  };
  monthlyHistory: { month: string; salary: number; bills: number; net: number }[];
  averages: {
    monthsCounted: number;
    avgMonthlySalaryInPrimary: number;
    avgMonthlyBillsInPrimary: number;
    avgMonthlyNetInPrimary: number;
  };
  /** Linear projections: current total balance + avg net flow × months. */
  projectedBalanceInPrimary: { in3Months: number; in6Months: number; in12Months: number };
}

const round = (n: number) => Math.round(n * 100) / 100;

export function buildSnapshot(state: AppState, now: Date = new Date()): AssistantSnapshot {
  const primary = state.primaryCurrency;
  const rate = state.exchangeRate;
  const toPrimary = (amount: number, currency: Currency) =>
    convert(amount, currency, primary, rate);

  const balanceCRC = state.accounts
    .filter((a) => a.currency === 'CRC')
    .reduce((s, a) => s + a.balance, 0);
  const balanceUSD = state.accounts
    .filter((a) => a.currency === 'USD')
    .reduce((s, a) => s + a.balance, 0);
  const totalBalance = toPrimary(balanceCRC, 'CRC') + toPrimary(balanceUSD, 'USD');

  const allBills = Object.values(state.months).flatMap((m) => m.bills);
  const cardDebt = (cardId: string, currency: Currency) =>
    allBills
      .filter((b) => b.creditCardId === cardId && b.currency === currency)
      .reduce((s, b) => s + b.amount, 0);
  const creditCards = state.creditCards.map((c) => ({
    name: c.name,
    debtCRC: round(c.owedCRC + cardDebt(c.id, 'CRC')),
    debtUSD: round(c.owedUSD + cardDebt(c.id, 'USD')),
  }));
  const totalCardDebt = creditCards.reduce(
    (s, c) => s + toPrimary(c.debtCRC, 'CRC') + toPrimary(c.debtUSD, 'USD'),
    0
  );

  const reserved = state.reserves.reduce(
    (s, r) => s + toPrimary(computeReserve(r, balanceCRC, balanceUSD), r.currency),
    0
  );

  const owed = state.imaginary
    .filter((e) => !e.collected)
    .reduce((s, e) => s + toPrimary(e.amountCRC, 'CRC') + toPrimary(e.amountUSD, 'USD'), 0);

  const subscriptions = state.subscriptions
    .filter((s) => s.active)
    .map((s) => ({
      name: s.name,
      monthlyCostInPrimary: round(toPrimary(s.amount, s.currency) / (s.frequencyMonths ?? 1)),
    }));
  const recurringMonthly = subscriptions.reduce((s, x) => s + x.monthlyCostInPrimary, 0);

  const nowKey = monthKey(now);
  const current = state.months[nowKey];
  const byCategory: Record<string, number> = {};
  let curBills = 0;
  let curPaid = 0;
  for (const b of current?.bills ?? []) {
    const v = toPrimary(b.amount, b.currency);
    curBills += v;
    if (b.paid) curPaid += v;
    byCategory[b.category] = round((byCategory[b.category] ?? 0) + v);
  }

  const pastKeys = Object.keys(state.months)
    .filter((k) => k <= nowKey)
    .sort()
    .slice(-6);
  const monthlyHistory = pastKeys.map((k) => {
    const m = state.months[k];
    const salary = toPrimary(m.salary.amount, m.salary.currency);
    const bills = m.bills.reduce((s, b) => s + toPrimary(b.amount, b.currency), 0);
    return { month: k, salary: round(salary), bills: round(bills), net: round(salary - bills) };
  });
  const counted = monthlyHistory.length || 1;
  const avgSalary = monthlyHistory.reduce((s, m) => s + m.salary, 0) / counted;
  const avgBills = monthlyHistory.reduce((s, m) => s + m.bills, 0) / counted;
  const avgNet = avgSalary - avgBills;

  return {
    today: now.toISOString().slice(0, 10),
    primaryCurrency: primary,
    exchangeRateCrcPerUsd: rate,
    categories: state.categories,
    accounts: state.accounts.map((a) => ({
      name: a.name,
      balance: round(a.balance),
      currency: a.currency,
    })),
    totalBalanceInPrimary: round(totalBalance),
    creditCards,
    totalCardDebtInPrimary: round(totalCardDebt),
    reservedSavingsInPrimary: round(reserved),
    moneyOwedToUserInPrimary: round(owed),
    subscriptions,
    recurringMonthlyCommitmentInPrimary: round(recurringMonthly),
    currentMonth: {
      month: nowKey,
      salaryInPrimary: round(
        toPrimary(current?.salary.amount ?? 0, current?.salary.currency ?? primary)
      ),
      billsTotalInPrimary: round(curBills),
      billsPaidInPrimary: round(curPaid),
      billsUnpaidInPrimary: round(curBills - curPaid),
      byCategoryInPrimary: byCategory,
    },
    monthlyHistory,
    averages: {
      monthsCounted: monthlyHistory.length,
      avgMonthlySalaryInPrimary: round(avgSalary),
      avgMonthlyBillsInPrimary: round(avgBills),
      avgMonthlyNetInPrimary: round(avgNet),
    },
    projectedBalanceInPrimary: {
      in3Months: round(totalBalance + avgNet * 3),
      in6Months: round(totalBalance + avgNet * 6),
      in12Months: round(totalBalance + avgNet * 12),
    },
  };
}
