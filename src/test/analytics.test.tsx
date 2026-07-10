import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp, goToMore, card, section, hero, money } from './helpers';
import { seededState, RATE } from './fixtures';

const crc = (n: number) => money(n, 'CRC');

describe('Analytics — empty account', () => {
  it('shows zero spend and the no-data message for categories', async () => {
    const { user } = renderApp();
    await goToMore(user, 'Analytics');

    hero('Total spent').getByText(crc(0));
    card('Months shown').getByText('1'); // the auto-created current month
    expect(screen.getByText('No data yet.')).toBeInTheDocument();
    expect(screen.getByText('Pick a category above to see all bills in it.')).toBeInTheDocument();
  });
});

describe('Analytics — with data', () => {
  it('totals all bills across months in the primary currency', async () => {
    const { user } = renderApp(seededState());
    await goToMore(user, 'Analytics');

    // ₡200,000 + ₡25,000 + ₡30,000 + $15·500 + ₡50,000 (prev month)
    hero('Total spent').getByText(crc(305000 + 15 * RATE));
    card('Months shown').getByText('2');
    // avg = total / 2
    card('Avg monthly bills').getByText(crc((305000 + 15 * RATE) / 2));
  });

  it('filters the bill list by category', async () => {
    const { user } = renderApp(seededState());
    await goToMore(user, 'Analytics');

    const catSection = section('Spending by category');
    await user.selectOptions(catSection.getByRole('combobox'), 'Rent');

    expect(screen.getByText('Bills in "Rent"')).toBeInTheDocument();
    expect(screen.getByText('Apartment')).toBeInTheDocument();
    expect(screen.queryByText('Groceries')).not.toBeInTheDocument();
  });

  it('month filter narrows totals to the selected months', async () => {
    const { user } = renderApp(seededState());
    await goToMore(user, 'Analytics');

    // deselect everything, keep nothing
    await user.click(screen.getByRole('button', { name: 'None' }));
    hero('Total spent').getByText(crc(0));
    card('Months shown').getByText('0');
    expect(screen.getAllByText('No data for selected months.').length).toBeGreaterThan(0);

    // back to all months
    await user.click(screen.getByRole('button', { name: 'All' }));
    card('Months shown').getByText('2');
  });
});
