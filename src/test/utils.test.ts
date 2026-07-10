import { describe, expect, it } from 'vitest';
import { convert, formatMoney, initials, monthDiff, monthKey, nextMonthKey } from '../utils';

describe('utils', () => {
  it('monthKey formats a date as YYYY-MM', () => {
    expect(monthKey(new Date(2026, 0, 5))).toBe('2026-01');
    expect(monthKey(new Date(2026, 11, 31))).toBe('2026-12');
  });

  it('nextMonthKey rolls over the year', () => {
    expect(nextMonthKey('2026-06')).toBe('2026-07');
    expect(nextMonthKey('2026-12')).toBe('2027-01');
  });

  it('monthDiff counts months across years', () => {
    expect(monthDiff('2026-03', '2026-03')).toBe(0);
    expect(monthDiff('2026-03', '2025-12')).toBe(3);
    expect(monthDiff('2025-12', '2026-03')).toBe(-3);
  });

  it('convert applies the CRC-per-USD rate in both directions', () => {
    expect(convert(10, 'USD', 'CRC', 500)).toBe(5000);
    expect(convert(5000, 'CRC', 'USD', 500)).toBe(10);
    expect(convert(1234, 'CRC', 'CRC', 500)).toBe(1234);
  });

  it('formatMoney prefixes the right currency symbol', () => {
    expect(formatMoney(1000, 'CRC').startsWith('₡')).toBe(true);
    expect(formatMoney(1000, 'USD').startsWith('$')).toBe(true);
  });

  it('initials takes the first letters of up to two words', () => {
    expect(initials('Luis Rodriguez')).toBe('LR');
    expect(initials('alice')).toBe('A');
    expect(initials('   ')).toBe('?');
  });
});
