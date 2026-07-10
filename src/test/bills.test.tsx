import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp, goTo, entry, addForm, section, money } from './helpers';
import { seededState, RATE } from './fixtures';

import type { User } from './helpers';

const crc = (n: number) => money(n, 'CRC');

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
  it('summarizes totals and paid progress', async () => {
    const { user } = renderApp(seededState());
    await goTo(user, 'Bills');

    // account bills ₡200,000 + $15, card bills ₡30,000 → full total ₡237,500
    expect(screen.getByText(crc(230000 + 15 * RATE))).toBeInTheDocument();
    expect(screen.getByText(`Already Paid: ${crc(25000)}`)).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: '+ Add subscription' }));
    const form = addForm(container);
    await user.type(form.getByPlaceholderText('Name (e.g. Netflix)'), 'Gym');
    await user.type(form.getByPlaceholderText('Amount'), '20000');
    await user.click(form.getByRole('button', { name: 'Add subscription' }));

    // one entry in the subscriptions list + one auto-created bill
    expect(screen.getAllByText('Gym')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'All · 5' })).toBeInTheDocument();
    expect(screen.getByText('2 subscriptions · 2 active')).toBeInTheDocument();
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
