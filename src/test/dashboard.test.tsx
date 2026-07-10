import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp, card, section, money } from './helpers';
import { seededState, RATE } from './fixtures';

const crc = (n: number) => money(n, 'CRC');
const usd = (n: number) => money(n, 'USD');

describe('Dashboard — empty account', () => {
  it('renders all sections with zero amounts', () => {
    renderApp();

    expect(screen.getByText('Remaining (Combined)')).toBeInTheDocument();
    expect(screen.getByText('Total Bills')).toBeInTheDocument();
    expect(screen.getByText('Total Balance')).toBeInTheDocument();
    expect(screen.getByText('Savings reserves')).toBeInTheDocument();
    expect(screen.getByText('Imaginary money')).toBeInTheDocument();
    expect(screen.getAllByText(crc(0)).length).toBeGreaterThan(0);
  });
});

describe('Dashboard — with data', () => {
  it('computes the remaining hero from balances − reserves − bills', () => {
    renderApp(seededState());

    // CRC: 500,000 − 50,000 reserves − 200,000 bills; USD: 1,000 − 200 − 15
    expect(screen.getByText(crc(250000 + 785 * RATE))).toBeInTheDocument();
    // per-currency remaining shows in the hero subline and its own stat card
    expect(screen.getAllByText(crc(250000)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(usd(785)).length).toBeGreaterThan(0);
  });

  it('shows total bills, total balance, card debt, reserves and imaginary totals', () => {
    renderApp(seededState());

    card('Total Bills').getByText(crc(200000 + 15 * RATE));
    card('Total Balance').getByText(crc(1000000));
    // card debt = the owed totals; the unpaid Amazon bill hasn't charged the card yet
    expect(screen.getByText(`${crc(100000)} · ${usd(50)}`)).toBeInTheDocument();
    expect(screen.getByText(`${crc(50000)} · ${usd(200)}`)).toBeInTheDocument(); // reserves
    expect(screen.getByText(`${crc(20000)} · ${usd(5)}`)).toBeInTheDocument(); // imaginary
    card('Salary').getByText(crc(800000));
  });

  it('lists people who still owe money', () => {
    renderApp(seededState());

    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.queryByText('Bob')).not.toBeInTheDocument(); // fully collected
  });

  it('folds credit-card debt into bills and remaining when toggled', async () => {
    const { user } = renderApp(seededState());

    await user.click(screen.getByRole('checkbox', { name: 'Include credit card debt in total bills' }));

    // bills: +₡100,000 and +$50 (the owed totals)
    card('Total Bills').getByText(crc(300000 + 65 * RATE));
    // remaining: CRC 250,000−100,000; USD 785−50
    expect(screen.getByText(crc(150000 + 735 * RATE))).toBeInTheDocument();
  });

  it('adds pending imaginary money to remaining when toggled', async () => {
    const { user } = renderApp(seededState());

    const imaginarySection = section('Imaginary money');
    await user.click(imaginarySection.getByRole('checkbox'));

    // remaining: CRC 250,000+20,000; USD 785+5
    expect(screen.getByText(crc(270000 + 790 * RATE))).toBeInTheDocument();
  });

  it('counts reserves as available in the emergency view', async () => {
    const { user } = renderApp(seededState());

    await user.click(screen.getByRole('checkbox', { name: /Count as available/ }));

    // remaining + reserves: CRC 300,000; USD 985
    expect(screen.getByText(crc(300000 + 985 * RATE))).toBeInTheDocument();
    expect(screen.getByText('incl. reserves (emergency)')).toBeInTheDocument();
  });

  it('stat cards navigate to their views', async () => {
    const { user } = renderApp(seededState());

    await user.click(screen.getByRole('button', { name: /Total Balance/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Accounts' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dashboard' }));
    await user.click(screen.getByRole('button', { name: /Total Bills/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Bills' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dashboard' }));
    await user.click(screen.getByRole('button', { name: /DEBT CARD/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Credit Cards' })).toBeInTheDocument();
  });
});
