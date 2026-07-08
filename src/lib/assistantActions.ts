/**
 * Actions the assistant can propose (create an account, bill, subscription…).
 *
 * The Cloud Function validates the model's output against a whitelist and the
 * client re-validates here. Nothing is ever applied automatically: each action
 * is shown to the user with an "Add it" button and only `applyAction` mutates
 * the store.
 */
import type { AppState, Bill, Currency } from '../types';
import { uid, formatMoney } from '../utils';
import { ensureMonth, currentMonthKey } from '../store';
import type { ProposedActionWire } from './firebase';
import type { T } from '../i18n';

export type ProposedAction =
  | { type: 'add_account'; name: string; balance: number; currency: Currency }
  | {
      type: 'add_bill';
      name: string;
      amount: number;
      currency: Currency;
      category?: string;
      accountName?: string;
      cardName?: string;
    }
  | {
      type: 'add_subscription';
      name: string;
      amount: number;
      currency: Currency;
      category?: string;
      frequencyMonths?: number;
    }
  | { type: 'add_credit_card'; name: string; owedCRC: number; owedUSD: number }
  | {
      type: 'add_reserve';
      name: string;
      mode: 'percent' | 'fixed';
      value: number;
      currency: Currency;
    }
  | {
      type: 'add_imaginary';
      personName: string;
      amountCRC: number;
      amountUSD: number;
      description: string;
    };

const isCurrency = (v: unknown): v is Currency => v === 'CRC' || v === 'USD';
const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : undefined;
const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= 1e12 ? n : undefined;
};
const pos = (v: unknown): number | undefined => {
  const n = num(v);
  return n !== undefined && n > 0 ? n : undefined;
};

/** Re-validate the wire actions from the function; silently drops invalid ones. */
export function parseActions(wire: ProposedActionWire[] | undefined): ProposedAction[] {
  const out: ProposedAction[] = [];
  for (const a of wire ?? []) {
    if (!a || typeof a !== 'object') continue;
    switch (a.type) {
      case 'add_account': {
        const name = str(a.name);
        const balance = num(a.balance);
        if (name && balance !== undefined && isCurrency(a.currency)) {
          out.push({ type: 'add_account', name, balance, currency: a.currency });
        }
        break;
      }
      case 'add_bill': {
        const name = str(a.name);
        const amount = pos(a.amount);
        if (name && amount && isCurrency(a.currency)) {
          out.push({
            type: 'add_bill',
            name,
            amount,
            currency: a.currency,
            category: str(a.category),
            accountName: str(a.accountName),
            cardName: str(a.cardName),
          });
        }
        break;
      }
      case 'add_subscription': {
        const name = str(a.name);
        const amount = pos(a.amount);
        const freq = pos(a.frequencyMonths);
        if (name && amount && isCurrency(a.currency)) {
          out.push({
            type: 'add_subscription',
            name,
            amount,
            currency: a.currency,
            category: str(a.category),
            frequencyMonths: freq ? Math.min(Math.round(freq), 24) : undefined,
          });
        }
        break;
      }
      case 'add_credit_card': {
        const name = str(a.name);
        if (name) {
          out.push({
            type: 'add_credit_card',
            name,
            owedCRC: pos(a.owedCRC) ?? 0,
            owedUSD: pos(a.owedUSD) ?? 0,
          });
        }
        break;
      }
      case 'add_reserve': {
        const name = str(a.name);
        const value = pos(a.value);
        const mode = a.mode === 'percent' || a.mode === 'fixed' ? a.mode : undefined;
        if (name && value && mode && isCurrency(a.currency)) {
          if (mode === 'percent' && value > 100) break;
          out.push({ type: 'add_reserve', name, mode, value, currency: a.currency });
        }
        break;
      }
      case 'add_imaginary': {
        const personName = str(a.personName);
        const amountCRC = pos(a.amountCRC) ?? 0;
        const amountUSD = pos(a.amountUSD) ?? 0;
        if (personName && (amountCRC > 0 || amountUSD > 0)) {
          out.push({
            type: 'add_imaginary',
            personName,
            amountCRC,
            amountUSD,
            description: str(a.description) ?? '',
          });
        }
        break;
      }
    }
  }
  return out.slice(0, 5);
}

/** Short human-readable summary shown on the confirmation card. */
export function describeAction(a: ProposedAction, t: T): string {
  switch (a.type) {
    case 'add_account':
      return `${t('addAccount')}: ${a.name} — ${formatMoney(a.balance, a.currency)}`;
    case 'add_bill': {
      const target = a.cardName ?? a.accountName;
      return `${t('addBill')}: ${a.name} — ${formatMoney(a.amount, a.currency)}${
        a.category ? ` (${a.category})` : ''
      }${target ? ` → ${target}` : ''}`;
    }
    case 'add_subscription':
      return `${t('addSubscription')}: ${a.name} — ${formatMoney(a.amount, a.currency)}${
        a.frequencyMonths && a.frequencyMonths > 1 ? ` / ${a.frequencyMonths} ${t('months')}` : ''
      }`;
    case 'add_credit_card': {
      const parts = [];
      if (a.owedCRC) parts.push(formatMoney(a.owedCRC, 'CRC'));
      if (a.owedUSD) parts.push(formatMoney(a.owedUSD, 'USD'));
      return `${t('addCard')}: ${a.name}${parts.length ? ` — ${parts.join(' · ')}` : ''}`;
    }
    case 'add_reserve':
      return `${t('addReserve')}: ${a.name} — ${
        a.mode === 'percent' ? `${a.value}%` : formatMoney(a.value, a.currency)
      }`;
    case 'add_imaginary': {
      const parts = [];
      if (a.amountCRC) parts.push(formatMoney(a.amountCRC, 'CRC'));
      if (a.amountUSD) parts.push(formatMoney(a.amountUSD, 'USD'));
      return `${t('addEntry')}: ${a.personName} — ${parts.join(' · ')}`;
    }
  }
}

const findByName = <E extends { name: string }>(list: E[], name?: string): E | undefined => {
  if (!name) return undefined;
  const n = name.toLowerCase();
  return (
    list.find((e) => e.name.toLowerCase() === n) ??
    list.find((e) => e.name.toLowerCase().includes(n) || n.includes(e.name.toLowerCase()))
  );
};

const matchCategory = (state: AppState, category?: string): string => {
  if (category) {
    const hit = state.categories.find((c) => c.toLowerCase() === category.toLowerCase());
    if (hit) return hit;
  }
  return state.categories.includes('Other') ? 'Other' : state.categories[0] ?? 'Other';
};

/** Apply a confirmed action to the app state. */
export function applyAction(state: AppState, a: ProposedAction): AppState {
  switch (a.type) {
    case 'add_account':
      return {
        ...state,
        accounts: [
          ...state.accounts,
          { id: uid(), name: a.name, balance: a.balance, currency: a.currency },
        ],
      };
    case 'add_bill': {
      const key = currentMonthKey();
      const next = ensureMonth(state, key);
      const month = next.months[key];
      const card = findByName(next.creditCards, a.cardName);
      const account = card ? undefined : findByName(next.accounts, a.accountName);
      const bill: Bill = {
        id: uid(),
        name: a.name,
        amount: a.amount,
        currency: a.currency,
        category: matchCategory(next, a.category),
        source: 'manual',
        creditCardId: card?.id,
        accountId: account?.id,
        paid: false,
      };
      return {
        ...next,
        months: { ...next.months, [key]: { ...month, bills: [...month.bills, bill] } },
      };
    }
    case 'add_subscription': {
      const withSub: AppState = {
        ...state,
        subscriptions: [
          ...state.subscriptions,
          {
            id: uid(),
            name: a.name,
            amount: a.amount,
            currency: a.currency,
            category: matchCategory(state, a.category),
            active: true,
            startMonth: currentMonthKey(),
            frequencyMonths:
              a.frequencyMonths && a.frequencyMonths > 1 ? a.frequencyMonths : undefined,
          },
        ],
      };
      // Materialize this month's bill right away instead of on next app load.
      return ensureMonth(withSub, currentMonthKey());
    }
    case 'add_credit_card':
      return {
        ...state,
        creditCards: [
          ...state.creditCards,
          { id: uid(), name: a.name, owedCRC: a.owedCRC, owedUSD: a.owedUSD },
        ],
      };
    case 'add_reserve':
      return {
        ...state,
        reserves: [
          ...state.reserves,
          { id: uid(), name: a.name, mode: a.mode, value: a.value, currency: a.currency },
        ],
      };
    case 'add_imaginary':
      return {
        ...state,
        imaginary: [
          ...state.imaginary,
          {
            id: uid(),
            personName: a.personName,
            amountCRC: a.amountCRC,
            amountUSD: a.amountUSD,
            description: a.description,
            date: new Date().toISOString().slice(0, 10),
            collected: false,
          },
        ],
      };
  }
}
