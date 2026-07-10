import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp, goToMore, entry, addForm, money, storedState } from './helpers';
import { seededState, RATE } from './fixtures';

const crc = (n: number) => money(n, 'CRC');
const usd = (n: number) => money(n, 'USD');

describe('Credit Cards — empty account', () => {
  it('shows the empty message and zero debt', async () => {
    const { user } = renderApp();
    await goToMore(user, 'Credit Cards');

    expect(screen.getByText('No credit cards yet.')).toBeInTheDocument();
    expect(screen.getAllByText(crc(0)).length).toBeGreaterThan(0);
  });

  it('adds a card with starting debt', async () => {
    const { user, container } = renderApp();
    await goToMore(user, 'Credit Cards');

    await user.click(screen.getByRole('button', { name: '+ Add credit card' }));
    const form = addForm(container);
    await user.type(form.getByPlaceholderText('Name (e.g. Visa BAC)'), 'Amex');
    const [owedCRC] = form.getAllByRole('spinbutton');
    await user.type(owedCRC, '5000');
    await user.click(form.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Amex')).toBeInTheDocument();
    expect(screen.getAllByText(crc(5000)).length).toBeGreaterThan(0);
  });
});

describe('Credit Cards — with data', () => {
  it('totals manual debt plus bills assigned to the card', async () => {
    const { user } = renderApp(seededState());
    await goToMore(user, 'Credit Cards');

    // DEBUG: temporary diagnostic to inspect CI-only failure — remove before merging.
    console.error('DEBUG months snapshot:', JSON.stringify(storedState().months, null, 2));
    console.error('DEBUG creditCards snapshot:', JSON.stringify(storedState().creditCards));

    // manual ₡100,000 + $50, plus the ₡30,000 Amazon bill
    expect(screen.getByText(crc(130000 + 50 * RATE))).toBeInTheDocument();
    expect(screen.getAllByText(crc(130000)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(usd(50)).length).toBeGreaterThan(0);
  });

  it('a payment reduces the manual debt', async () => {
    const { user } = renderApp(seededState());
    await goToMore(user, 'Credit Cards');

    await user.click(screen.getByText('Visa'));
    await user.click(screen.getByRole('button', { name: 'Pay' }));

    const spinbuttons = entry('Visa').getAllByRole('spinbutton');
    const payInput = spinbuttons[spinbuttons.length - 1];
    await user.type(payInput, '30000');
    await user.click(screen.getByRole('button', { name: 'Make payment' }));

    // manual CRC now ₡70,000 → card total ₡100,000; combined ₡125,000
    expect(screen.getByText(crc(100000 + 50 * RATE))).toBeInTheDocument();
    expect(entry('Visa').getByDisplayValue('70000')).toBeInTheDocument();
  });

  it('a correction lands the card total exactly on the real value', async () => {
    const { user } = renderApp(seededState());
    await goToMore(user, 'Credit Cards');

    await user.click(screen.getByText('Visa'));
    await user.click(screen.getByRole('button', { name: 'Correct' }));

    // prefilled with the current totals (₡130,000 / $50)
    const realCRC = entry('Visa').getByDisplayValue('130000');
    await user.clear(realCRC);
    await user.type(realCRC, '150000');
    await user.click(screen.getByRole('button', { name: 'Apply correction' }));

    // manual debt absorbed the +₡20,000 difference
    expect(entry('Visa').getByDisplayValue('120000')).toBeInTheDocument();
    expect(screen.getByText(crc(150000 + 50 * RATE))).toBeInTheDocument();
  });

  it('removes a card', async () => {
    const { user } = renderApp(seededState());
    await goToMore(user, 'Credit Cards');

    await user.click(screen.getByText('Visa'));
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.getByText('No credit cards yet.')).toBeInTheDocument();
  });
});
