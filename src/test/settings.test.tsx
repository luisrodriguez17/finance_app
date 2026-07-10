import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderApp, goTo, goToMore, section, storedState, money } from './helpers';
import { seededState } from './fixtures';

const crc = (n: number) => money(n, 'CRC');

describe('Settings', () => {
  it('toggles the theme and stamps it on the document', async () => {
    const { user } = renderApp();
    await goToMore(user, 'Settings');

    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.click(section('Appearance').getByRole('checkbox'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(storedState().theme).toBe('light');
  });

  it('switches the language to Spanish everywhere', async () => {
    const { user } = renderApp();
    await goToMore(user, 'Settings');

    await user.selectOptions(screen.getByDisplayValue('English'), 'es');
    expect(screen.getByRole('heading', { level: 2, name: 'Ajustes' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Resumen' })); // Dashboard tab
    expect(screen.getByRole('heading', { level: 2, name: 'Resumen' })).toBeInTheDocument();
  });

  it('changes the primary display currency', async () => {
    const { user } = renderApp();
    await goToMore(user, 'Settings');

    await user.selectOptions(screen.getByDisplayValue('₡ Colones'), 'USD');
    await goTo(user, 'Accounts');
    expect(screen.getByText('Combined (USD)')).toBeInTheDocument();
  });

  it('updates the exchange rate used for conversions', async () => {
    const { user } = renderApp(seededState());
    await goToMore(user, 'Settings');

    const rateField = screen.getByText('Exchange rate (1 USD = ? CRC)').parentElement!;
    const rateInput = within(rateField).getByRole('spinbutton');
    await user.clear(rateInput);
    await user.type(rateInput, '1000');

    await goTo(user, 'Accounts');
    // ₡500,000 + $1,000·1000 = ₡1,500,000
    expect(screen.getByText(crc(1500000))).toBeInTheDocument();
  });

  it('adds and removes categories', async () => {
    const { user } = renderApp();
    await goToMore(user, 'Settings');

    const cats = section('Categories');
    await user.type(cats.getByPlaceholderText('New category'), 'Gym');
    await user.click(cats.getByRole('button', { name: 'Add' }));
    expect(cats.getByText('Gym')).toBeInTheDocument();

    const tag = cats.getByText('Gym').closest('.tag')!;
    await user.click(within(tag as HTMLElement).getByRole('button', { name: '×' }));
    expect(cats.queryByText('Gym')).not.toBeInTheDocument();
    expect(storedState().categories).not.toContain('Gym');
  });

  it('salary schedule: enabling and running now deposits today’s salary', async () => {
    const { user } = renderApp();
    await goToMore(user, 'Settings');

    const sched = section('Salary schedule');
    const [dayInput, amountInput] = sched.getAllByRole('spinbutton');

    // pay day = today, so exactly one deposit (today's) is due after enabling.
    // Single change events: the day input coerces an emptied value to 1, so
    // clear-then-type would concatenate digits onto that 1.
    fireEvent.change(dayInput, { target: { value: String(new Date().getDate()) } });
    fireEvent.change(amountInput, { target: { value: '1000' } });
    await user.click(sched.getAllByRole('checkbox')[0]); // Enabled
    await user.click(sched.getByRole('button', { name: 'Run now' }));

    await goTo(user, 'Budget');
    expect(screen.getByText(crc(1000))).toBeInTheDocument();
  });

  it('salary schedule: reset history clears applied dates after confirm', async () => {
    const { user } = renderApp();
    await goToMore(user, 'Settings');

    const sched = section('Salary schedule');
    await user.click(sched.getAllByRole('checkbox')[0]); // Enabled → marks past as applied
    expect(sched.queryByText('0 past deposits recorded')).not.toBeInTheDocument();

    await user.click(sched.getByRole('button', { name: 'Reset applied history' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(sched.getByText('0 past deposits recorded')).toBeInTheDocument();
  });

  it('imports app state pasted as JSON', async () => {
    const { user } = renderApp();
    await goToMore(user, 'Settings');

    await user.click(screen.getByRole('button', { name: 'Paste JSON' }));
    const textarea = screen.getByPlaceholderText('Paste exported JSON here');
    await user.click(textarea);
    await user.paste(JSON.stringify(seededState()));
    await user.click(screen.getByRole('button', { name: 'Import JSON' }));

    await goTo(user, 'Accounts');
    expect(screen.getByText('BAC Checking')).toBeInTheDocument();
  });

  it('rejects pasted JSON that is not an app backup', async () => {
    const { user } = renderApp();
    await goToMore(user, 'Settings');

    await user.click(screen.getByRole('button', { name: 'Paste JSON' }));
    const textarea = screen.getByPlaceholderText('Paste exported JSON here');
    await user.click(textarea);
    await user.paste('{"not":"a backup"}');
    await user.click(screen.getByRole('button', { name: 'Import JSON' }));

    expect(window.alert).toHaveBeenCalledWith('Invalid file');
  });
});
