import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import type { AppState, Currency } from '../types';
import { formatMoney } from '../utils';

export const STORAGE_KEY = 'finance-app-state-v1';

/**
 * Expected money text, whitespace-normalized. formatMoney uses the runtime
 * locale, which may pick no-break spaces as group separators; Testing Library
 * normalizes DOM whitespace to plain spaces, so expected strings must match.
 */
export const money = (n: number, c: Currency) => formatMoney(n, c).replace(/\s+/g, ' ');

export type User = ReturnType<typeof userEvent.setup>;

/** Read back what the app persisted. */
export function storedState(): AppState {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!) as AppState;
}

/**
 * Render the whole app the way a user gets it: state (if any) seeded into
 * localStorage first, then <App /> mounted fresh.
 */
export function renderApp(state?: AppState) {
  if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const user = userEvent.setup();
  const view = render(<App />);
  return { user, ...view };
}

type PrimaryTab = 'Dashboard' | 'Accounts' | 'Bills' | 'Budget';
type MoreTab = 'Credit Cards' | 'Imaginary $' | 'Analytics' | 'Settings';

/** Navigate via the bottom nav. */
export async function goTo(user: User, tab: PrimaryTab) {
  await user.click(screen.getByRole('button', { name: tab }));
}

/** Navigate via the "More" sheet. */
export async function goToMore(user: User, tab: MoreTab) {
  await user.click(screen.getByRole('button', { name: 'More' }));
  await user.click(screen.getByRole('button', { name: tab }));
}

/** Scope queries to the `.section` card containing the given title text. */
export function section(title: string) {
  const el = screen.getByText(title).closest('.section');
  if (!el) throw new Error(`No .section contains "${title}"`);
  return within(el as HTMLElement);
}

/** Scope queries to the `.hero` banner containing the given label text. */
export function hero(label: string) {
  const el = screen.getByText(label).closest('.hero');
  if (!el) throw new Error(`No .hero contains "${label}"`);
  return within(el as HTMLElement);
}

/** Scope queries to the `.card` stat tile containing the given title text. */
export function card(title: string) {
  const el = screen.getByText(title).closest('.card');
  if (!el) throw new Error(`No .card contains "${title}"`);
  return within(el as HTMLElement);
}

/** Scope queries to the expandable list row (`.entry-item`) containing the given text. */
export function entry(text: string) {
  const el = screen.getByText(text).closest('.entry-item');
  if (!el) throw new Error(`No .entry-item contains "${text}"`);
  return within(el as HTMLElement);
}

/** The currently open add-form (there is at most one per view). */
export function addForm(container: HTMLElement) {
  const el = container.querySelector('.add-form');
  if (!el) throw new Error('No open .add-form found');
  return within(el as HTMLElement);
}
