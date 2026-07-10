import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import App from '../App';
import { renderApp, goTo, goToMore, storedState } from './helpers';
import { seededState, CUR, PREV } from './fixtures';

describe('app shell', () => {
  it('opens on the Dashboard with a fresh (empty) account', () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 2, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('creates the current month on first load and persists it', () => {
    renderApp();
    expect(storedState().months[CUR]).toBeTruthy();
    expect(storedState().months[CUR].bills).toEqual([]);
  });

  it('navigates between the primary tabs via the bottom nav', async () => {
    const { user } = renderApp();

    await goTo(user, 'Accounts');
    expect(screen.getByRole('heading', { level: 2, name: 'Accounts' })).toBeInTheDocument();

    await goTo(user, 'Bills');
    expect(screen.getByRole('heading', { level: 2, name: 'Bills' })).toBeInTheDocument();

    await goTo(user, 'Budget');
    expect(screen.getByRole('heading', { level: 2, name: 'Budget' })).toBeInTheDocument();

    await goTo(user, 'Dashboard');
    expect(screen.getByRole('heading', { level: 2, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('reaches the secondary views through the More sheet', async () => {
    const { user } = renderApp();

    await goToMore(user, 'Credit Cards');
    expect(screen.getByRole('heading', { level: 2, name: 'Credit Cards' })).toBeInTheDocument();

    await goToMore(user, 'Imaginary $');
    expect(screen.getByRole('heading', { level: 2, name: 'Imaginary Money' })).toBeInTheDocument();

    await goToMore(user, 'Analytics');
    expect(screen.getByRole('heading', { level: 2, name: 'Analytics' })).toBeInTheDocument();

    await goToMore(user, 'Settings');
    expect(screen.getByRole('heading', { level: 2, name: 'Settings' })).toBeInTheDocument();
  });

  it('switches months with the header selector and shows that month’s bills', async () => {
    const { user } = renderApp(seededState());

    await user.selectOptions(screen.getByRole('combobox'), PREV);
    await goTo(user, 'Bills');

    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.queryByText('Apartment')).not.toBeInTheDocument();
  });

  it('persists changes across a full unmount/remount (localStorage round-trip)', async () => {
    const { user, unmount } = renderApp();

    await goTo(user, 'Accounts');
    await user.click(screen.getByRole('button', { name: '+ Add account' }));
    await user.type(screen.getByPlaceholderText('Name (e.g. BAC checking)'), 'Test Wallet');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Test Wallet')).toBeInTheDocument();

    unmount();
    const user2 = userEvent.setup();
    render(<App />);
    await goTo(user2, 'Accounts');
    expect(screen.getByText('Test Wallet')).toBeInTheDocument();
  });
});
