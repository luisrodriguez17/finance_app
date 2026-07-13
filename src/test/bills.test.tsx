import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderApp, goTo, goToMore, entry, addForm, section, hero, card, money } from './helpers';
import { seededState, RATE } from './fixtures';
import type { User } from './helpers';
import { todayISODate } from '../utils';

const crc = (n: number) => money(n, 'CRC');
const usd = (n: number) => money(n, 'USD');

const openAddBill = async (user: User) => {
  await user.click(screen.getByRole('button', { name: '+ Add a bill' }));
};

describe('Bills — empty account', () => {
  it('shows the empty message and no summary', async () => {
    const { user } = renderApp();
    await goTo(user, 'Bills');

    expect(screen.getByText('No bills for this month yet.')).toBeInTheDocument();
    expect(screen.queryByText('Full Total')).not.toBeInTheDocument();
  });

  it('adds a manual unpaid bill', async () => {
    const { user, container } = renderApp();
    await goTo(user, 'Bills');

    await openAddBill(user);
    const form = addForm(container);
    await user.type(form.getByPlaceholderText('Name (e.g. Electricity)'), 'Water');
    await user.type(form.getByPlaceholderText('Amount'), '10000');
    await user.click(form.getByRole('checkbox', { name: 'Paid' }));
    await user.click(form.getByRole('button', { name: 'Add bill' }));

    expect(screen.getByText('Water')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unpaid · 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paid · 0' })).toBeInTheDocument();
  });
});

describe('Bills — with data', () => {
  it('summarizes totals per currency and paid progress', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Bills');

    // all bills: ₡255,000 and $15, shown per currency (never blended)
    hero('Full Total').getByText(crc(255000));
    hero('Full Total').getByText(usd(15));
    expect(screen.getByText(`Already Paid: ${crc(25000)}`)).toBeInTheDocument();
    // the secondary currency lives in a nested span, so match on full text content
    expect(screen.getByText(`Remaining: ${crc(230000)}`)).toHaveTextContent(
      `Remaining: ${crc(230000)} · ${usd(15)}`
    );

    // consistent buckets: account bills + card bills = everything
    expect(card('Account Bills').getByText(crc(225000))).toHaveTextContent(
      `${crc(225000)} · ${usd(15)}`
    );
    card('Account Bills').getByText(/3 bills/);
    card('Credit Card Bills').getByText(crc(30000));
    card('Credit Card Bills').getByText(/1 bills/);
  });

  it('tapping a summary card scopes the list to that bucket', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Bills');

    await user.click(screen.getByRole('button', { name: /Credit Card Bills/ }));
    expect(screen.getByRole('button', { name: 'All · 1' })).toBeInTheDocument();
    expect(screen.getByText('Amazon')).toBeInTheDocument();
    expect(screen.queryByText('Apartment')).not.toBeInTheDocument();

    // the active-scope chip clears the filter
    await user.click(screen.getByRole('button', { name: 'Credit Card Bills ×' }));
    expect(screen.getByRole('button', { name: 'All · 4' })).toBeInTheDocument();
  });

  it('search narrows the bill list by name', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Bills');

    await user.type(screen.getByPlaceholderText('Search bills…'), 'Apart');
    expect(screen.getByText('Apartment')).toBeInTheDocument();
    expect(screen.queryByText('Netflix')).not.toBeInTheDocument();
  });

  it('filters the bill list by category', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Bills');

    await user.selectOptions(screen.getByDisplayValue('— All —'), 'Rent');
    expect(screen.getByText('Apartment')).toBeInTheDocument();
    expect(screen.queryByText('Amazon')).not.toBeInTheDocument();
  });

  it('marking a card bill paid charges the card; unpaying refunds it', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Bills');

    await user.click(entry('Amazon').getByRole('checkbox'));
    await goToMore(user, 'Credit Cards');
    expect(screen.getByText(crc(130000 + 50 * RATE))).toBeInTheDocument();

    await goTo(user, 'Bills');
    await user.click(entry('Amazon').getByRole('checkbox'));
    await goToMore(user, 'Credit Cards');
    expect(screen.getByText(crc(100000 + 50 * RATE))).toBeInTheDocument();
  });

  it('flags bills that share the exact same amount', async () => {
    const { user, container } = renderApp(seededState());
    await goTo(user, 'Bills');

    await openAddBill(user);
    const form = addForm(container);
    await user.type(form.getByPlaceholderText('Name (e.g. Electricity)'), 'Water');
    await user.type(form.getByPlaceholderText('Amount'), '30000'); // same as Amazon
    await user.click(form.getByRole('checkbox', { name: 'Paid' })); // add unpaid
    await user.click(form.getByRole('button', { name: 'Add bill' }));

    expect(container.querySelectorAll('.dup-dot')).toHaveLength(2);
    await user.click(screen.getByText('Water'));
    expect(screen.getByText(/Same amount as "Amazon" this month/)).toBeInTheDocument();
  });

  it('defaults the date field to today', async () => {
    const { user, container } = renderApp(seededState());
    await goTo(user, 'Bills');

    await openAddBill(user);
    const form = addForm(container);
    const dateField = form.getByText('Date').closest('.field')!;
    expect(dateField.querySelector('input')).toHaveValue(todayISODate());
  });

  it('remembers the last account/card used across bill additions', async () => {
    const { user, container } = renderApp(seededState());
    await goTo(user, 'Bills');

    await openAddBill(user);
    let form = addForm(container);
    await user.type(form.getByPlaceholderText('Name (e.g. Electricity)'), 'Water');
    await user.type(form.getByPlaceholderText('Amount'), '10000');
    await user.selectOptions(
      form.getByDisplayValue('No account'),
      screen.getByRole('option', { name: 'BAC Checking' })
    );
    await user.click(form.getByRole('button', { name: 'Add bill' }));

    await openAddBill(user);
    form = addForm(container);
    expect(form.getByDisplayValue('BAC Checking')).toBeInTheDocument();
  });

  it('stores an optional date on a bill and shows it in the details', async () => {
    const { user, container } = renderApp(seededState());
    await goTo(user, 'Bills');

    await openAddBill(user);
    const form = addForm(container);
    await user.type(form.getByPlaceholderText('Name (e.g. Electricity)'), 'Water');
    await user.type(form.getByPlaceholderText('Amount'), '12345');
    const dateField = form.getByText('Date').closest('.field')!;
    fireEvent.change(dateField.querySelector('input')!, { target: { value: '2026-07-15' } });
    await user.click(form.getByRole('button', { name: 'Add bill' }));

    await user.click(screen.getByText('Water'));
    expect(screen.getByText('2026-07-15')).toBeInTheDocument();
  });

  it('filters bills by paid state', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Bills');

    expect(screen.getByRole('button', { name: 'All · 4' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Paid · 1' }));
    expect(screen.getByText('Fiber')).toBeInTheDocument();
    expect(screen.queryByText('Apartment')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Unpaid · 3' }));
    expect(screen.getByText('Apartment')).toBeInTheDocument();
    expect(screen.queryByText('Fiber')).not.toBeInTheDocument();
  });

  it('adding a paid bill on an account deducts its balance', async () => {
    const { user, container } = renderApp(seededState());
    await goTo(user, 'Bills');

    await openAddBill(user);
    const form = addForm(container);
    await user.type(form.getByPlaceholderText('Name (e.g. Electricity)'), 'Water');
    await user.type(form.getByPlaceholderText('Amount'), '10000');
    await user.selectOptions(
      form.getByDisplayValue('No account'),
      screen.getByRole('option', { name: 'BAC Checking' })
    );
    await user.click(form.getByRole('button', { name: 'Add bill' })); // "Paid" is on by default

    await goTo(user, 'Accounts');
    expect(screen.getAllByText(crc(490000)).length).toBeGreaterThan(0);
  });

  it('unchecking paid refunds the account', async () => {
    const { user, container } = renderApp(seededState());
    await goTo(user, 'Bills');

    await openAddBill(user);
    const form = addForm(container);
    await user.type(form.getByPlaceholderText('Name (e.g. Electricity)'), 'Water');
    await user.type(form.getByPlaceholderText('Amount'), '10000');
    await user.selectOptions(
      form.getByDisplayValue('No account'),
      screen.getByRole('option', { name: 'BAC Checking' })
    );
    await user.click(form.getByRole('button', { name: 'Add bill' }));

    await user.click(entry('Water').getByRole('checkbox'));

    await goTo(user, 'Accounts');
    expect(screen.getAllByText(crc(500000)).length).toBeGreaterThan(0);
  });

  it('removing a settled bill refunds the account', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Bills');

    await user.click(screen.getByText('Fiber'));
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.queryByText('Fiber')).not.toBeInTheDocument();
    await goTo(user, 'Accounts');
    expect(screen.getAllByText(crc(525000)).length).toBeGreaterThan(0);
  });

  it('refuses to pay from an account in another currency (bill added unpaid)', async () => {
    const { user, container } = renderApp(seededState());
    await goTo(user, 'Bills');

    await openAddBill(user);
    const form = addForm(container);
    await user.type(form.getByPlaceholderText('Name (e.g. Electricity)'), 'Foreign');
    await user.type(form.getByPlaceholderText('Amount'), '20');
    await user.selectOptions(form.getByDisplayValue('₡ CRC'), 'USD');
    await user.selectOptions(
      form.getByDisplayValue('No account'),
      screen.getByRole('option', { name: 'BAC Checking' })
    );
    await user.click(form.getByRole('button', { name: 'Add bill' }));

    expect(window.alert).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Foreign')).toBeInTheDocument();
    expect(entry('Foreign').getByRole('checkbox')).not.toBeChecked();

    // trying to mark it paid also refuses
    await user.click(entry('Foreign').getByRole('checkbox'));
    expect(window.alert).toHaveBeenCalledTimes(2);
    expect(entry('Foreign').getByRole('checkbox')).not.toBeChecked();

    await goTo(user, 'Accounts');
    expect(screen.getAllByText(crc(500000)).length).toBeGreaterThan(0);
  });

  it('lists subscriptions and adding one creates this month’s bill', async () => {
    const { user, container } = renderApp(seededState());
    await goTo(user, 'Bills');

    await user.click(screen.getByText('Subscriptions (auto-applied each month)'));
    expect(screen.getByText('1 subscriptions · 1 active')).toBeInTheDocument();
    expect(screen.getByText(`Monthly spend: ${crc(0)} · ${usd(15)}`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Add subscription' }));
    const form = addForm(container);
    await user.type(form.getByPlaceholderText('Name (e.g. Netflix)'), 'Gym');
    await user.type(form.getByPlaceholderText('Amount'), '20000');
    await user.click(form.getByRole('button', { name: 'Add subscription' }));

    // one entry in the subscriptions list + one auto-created bill
    expect(screen.getAllByText('Gym')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'All · 5' })).toBeInTheDocument();
    expect(screen.getByText('2 subscriptions · 2 active')).toBeInTheDocument();
    expect(screen.getByText(`Monthly spend: ${crc(20000)} · ${usd(15)}`)).toBeInTheDocument();
  });

  it('deactivating a subscription stops it from landing in new months', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Bills');

    await user.click(screen.getByText('Subscriptions (auto-applied each month)'));
    const subSection = section('Subscriptions (auto-applied each month)');
    await user.click(subSection.getByRole('checkbox', { name: 'Active' }));

    expect(screen.getByText('1 subscriptions · 0 active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });
});
