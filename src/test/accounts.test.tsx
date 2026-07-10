import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp, goTo, entry, money } from './helpers';
import { seededState } from './fixtures';

const crc = (n: number) => money(n, 'CRC');
const usd = (n: number) => money(n, 'USD');

describe('Accounts — empty account', () => {
  it('shows the empty message and a zero combined total', async () => {
    const { user } = renderApp();
    await goTo(user, 'Accounts');

    expect(screen.getByText('No accounts yet.')).toBeInTheDocument();
    expect(screen.getAllByText(crc(0)).length).toBeGreaterThan(0);
  });

  it('adds an account and updates the totals', async () => {
    const { user } = renderApp();
    await goTo(user, 'Accounts');

    await user.click(screen.getByRole('button', { name: '+ Add account' }));
    await user.type(screen.getByPlaceholderText('Name (e.g. BAC checking)'), 'Cash');
    await user.type(screen.getByPlaceholderText('Balance'), '25000');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getAllByText(crc(25000)).length).toBeGreaterThan(0);
    expect(screen.queryByText('No accounts yet.')).not.toBeInTheDocument();
  });
});

describe('Accounts — with data', () => {
  it('shows every account and the combined total across currencies', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Accounts');

    expect(screen.getByText('BAC Checking')).toBeInTheDocument();
    expect(screen.getByText('US Savings')).toBeInTheDocument();
    // ₡500,000 + $1,000 at 500 = ₡1,000,000
    expect(screen.getByText(crc(1000000))).toBeInTheDocument();
  });

  it('edits a balance in place and the totals follow', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Accounts');

    await user.click(screen.getByText('BAC Checking'));
    const balanceInput = entry('BAC Checking').getByRole('spinbutton');
    await user.clear(balanceInput);
    await user.type(balanceInput, '600000');

    expect(screen.getByText(crc(1100000))).toBeInTheDocument();
  });

  it('changes an account currency and recomputes totals', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Accounts');

    await user.click(screen.getByText('US Savings'));
    await user.selectOptions(entry('US Savings').getByDisplayValue('$ USD'), 'CRC');

    // 500,000 + 1,000 both CRC now (hero total and CRC subtotal)
    expect(screen.getAllByText(crc(501000)).length).toBeGreaterThan(0);
    expect(screen.getByText(usd(0))).toBeInTheDocument();
  });

  it('removes an account', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Accounts');

    await user.click(screen.getByText('BAC Checking'));
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.queryByText('BAC Checking')).not.toBeInTheDocument();
    // only the $1,000 account remains → combined ₡500,000
    expect(screen.getAllByText(crc(500000)).length).toBeGreaterThan(0);
  });
});
