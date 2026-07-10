import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, goTo, card, section, money } from './helpers';
import { seededState } from './fixtures';

const crc = (n: number) => money(n, 'CRC');
const usd = (n: number) => money(n, 'USD');

describe('Budget — empty account', () => {
  it('shows zero salary and the empty messages', async () => {
    const { user } = renderApp();
    await goTo(user, 'Budget');

    expect(screen.getAllByText('0% allocated').length).toBeGreaterThan(0);
    expect(screen.getByText('No allocations yet.')).toBeInTheDocument();
    expect(screen.getByText('No reserves yet.')).toBeInTheDocument();
  });
});

describe('Budget — with data', () => {
  it('shows the salary and per-slice amounts', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Budget');

    expect(screen.getByText(crc(800000))).toBeInTheDocument();
    expect(screen.getAllByText('70% allocated').length).toBeGreaterThan(0);
    expect(screen.getByText('Needs')).toBeInTheDocument();
    expect(screen.getByText(crc(400000))).toBeInTheDocument(); // 50% of salary
    expect(screen.getByText(crc(160000))).toBeInTheDocument(); // 20% of salary
  });

  it('adds an allocation and updates the total percentage', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Budget');

    const form = section('Add salary allocation');
    await user.type(form.getByPlaceholderText('Name'), 'Fun');
    await user.type(form.getByPlaceholderText('%'), '10');
    await user.click(form.getByRole('button', { name: 'Add' }));

    expect(screen.getAllByText('80% allocated').length).toBeGreaterThan(0);
    expect(screen.getByText('Fun')).toBeInTheDocument();
  });

  it('removes an allocation', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Budget');

    const row = screen.getByText('Needs').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Remove' }));

    expect(screen.queryByText('Needs')).not.toBeInTheDocument();
    expect(screen.getAllByText('20% allocated').length).toBeGreaterThan(0);
  });

  it('computes reserved amounts from balances (percent and fixed)', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Budget');

    card('Reserved (CRC)').getByText(crc(50000)); // 10% of ₡500,000
    card('Reserved (USD)').getByText(usd(200)); // fixed
  });

  it('adds a fixed reserve', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Budget');

    const form = section('Add reserve');
    await user.type(form.getByPlaceholderText('Name (e.g. Emergency fund)'), 'Laptop');
    await user.selectOptions(form.getByDisplayValue('% of balance'), 'fixed');
    await user.type(form.getByPlaceholderText('Amount'), '100');
    await user.selectOptions(form.getByDisplayValue('₡ CRC'), 'USD');
    await user.click(form.getByRole('button', { name: 'Add' }));

    card('Reserved (USD)').getByText(usd(300)); // 200 existing + 100
  });

  it('removes a reserve', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Budget');

    const row = screen.getByDisplayValue('Trip').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Remove' }));

    card('Reserved (USD)').getByText(usd(0));
  });
});
