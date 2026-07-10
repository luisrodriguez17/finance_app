import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp, goToMore, entry, addForm, money } from './helpers';
import { seededState, RATE } from './fixtures';

const crc = (n: number) => money(n, 'CRC');

describe('Imaginary Money — empty account', () => {
  it('shows the empty message', async () => {
    const { user } = renderApp();
    await goToMore(user, 'Imaginary $');

    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
  });

  it('adds an entry for a new person', async () => {
    const { user, container } = renderApp();
    await goToMore(user, 'Imaginary $');

    await user.click(screen.getByRole('button', { name: '+ Add entry' }));
    const form = addForm(container);
    await user.type(form.getByPlaceholderText("Person's name"), 'Carol');
    await user.type(form.getByPlaceholderText('Owed in ₡'), '1000');
    await user.type(form.getByPlaceholderText('What is it for?'), 'Coffee');
    await user.click(form.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.getAllByText(crc(1000)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 pending/).length).toBeGreaterThan(0);
  });
});

describe('Imaginary Money — with data', () => {
  it('groups entries per person and totals only pending ones', async () => {
    const { user } = renderApp(seededState());
    await goToMore(user, 'Imaginary $');

    // pending: ₡20,000 + $5 → combined ₡22,500; Bob's collected loan excluded
    expect(screen.getByText(crc(20000 + 5 * RATE))).toBeInTheDocument();
    expect(screen.getByText(/2 people/)).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(entry('Bob').getByText('All collected')).toBeInTheDocument();
  });

  it('collecting an entry moves it out of the outstanding total', async () => {
    const { user } = renderApp(seededState());
    await goToMore(user, 'Imaginary $');

    await user.click(screen.getByText('Alice'));
    const checkboxes = entry('Alice').getAllByRole('checkbox', { name: /Collected/ });
    await user.click(checkboxes[0]); // the ₡20,000 lunch entry

    expect(screen.getByText(crc(5 * RATE))).toBeInTheDocument();
    expect(entry('Alice').getByText(/1 pending · 2 entries/)).toBeInTheDocument();
  });

  it('removes a single entry', async () => {
    const { user } = renderApp(seededState());
    await goToMore(user, 'Imaginary $');

    await user.click(screen.getByText('Alice'));
    const removeButtons = entry('Alice').getAllByRole('button', { name: 'Remove' });
    await user.click(removeButtons[0]);

    expect(entry('Alice').getByText(/1 entries/)).toBeInTheDocument();
    expect(screen.getByText(crc(5 * RATE))).toBeInTheDocument();
  });
});
