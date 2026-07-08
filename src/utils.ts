import type { Currency, SavingsReserve } from './types';

export const uid = () => Math.random().toString(36).slice(2, 10);

export const monthKey = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** The YYYY-MM key immediately following the given one. */
export const nextMonthKey = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m, 1));
};

/** Difference in months between two YYYY-MM keys (a - b). */
export const monthDiff = (a: string, b: string) => {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (ay - by) * 12 + (am - bm);
};

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
};

export const formatMoney = (amount: number, currency: Currency) => {
  const symbol = currency === 'USD' ? '$' : '₡';
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

/** Amount locked away by a savings reserve, in the reserve's own currency. */
export const computeReserve = (r: SavingsReserve, balanceCRC: number, balanceUSD: number) => {
  const base = r.currency === 'CRC' ? balanceCRC : balanceUSD;
  return r.mode === 'percent' ? base * (r.value / 100) : r.value;
};

export const convert = (
  amount: number,
  from: Currency,
  to: Currency,
  crcPerUsd: number
) => {
  if (from === to) return amount;
  if (from === 'USD' && to === 'CRC') return amount * crcPerUsd;
  return amount / crcPerUsd;
};
