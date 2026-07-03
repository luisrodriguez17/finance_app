import { useState } from 'react';
import type { Account, AppState, Currency } from '../types';
import { formatMoney, uid, convert } from '../utils';
import type { T } from '../i18n';
import { AddToggle, EntryItem, Field } from './ui';

type Props = {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
  t: T;
};

export default function Accounts({ state, update, t }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState<Currency>(state.primaryCurrency);

  const add = () => {
    if (!name) return;
    const acc: Account = { id: uid(), name, balance: Number(balance) || 0, currency };
    update((s) => ({ ...s, accounts: [...s.accounts, acc] }));
    setName('');
    setBalance('');
    setShowAdd(false);
  };

  const updateAccount = (id: string, patch: Partial<Account>) =>
    update((s) => ({
      ...s,
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));

  const remove = (id: string) =>
    update((s) => ({ ...s, accounts: s.accounts.filter((a) => a.id !== id) }));

  const totalCRC = state.accounts.filter((a) => a.currency === 'CRC').reduce((s, a) => s + a.balance, 0);
  const totalUSD = state.accounts.filter((a) => a.currency === 'USD').reduce((s, a) => s + a.balance, 0);
  const combined =
    convert(totalCRC, 'CRC', state.primaryCurrency, state.exchangeRate) +
    convert(totalUSD, 'USD', state.primaryCurrency, state.exchangeRate);

  return (
    <div>
      <h2>{t('accountsTitle')}</h2>
      <p className="muted">{t('accountsIntro')}</p>

      <div className="hero">
        <div className="hero-label">{t('combinedTotal', { cur: state.primaryCurrency })}</div>
        <div className="hero-value">{formatMoney(combined, state.primaryCurrency)}</div>
        <div className="hero-sub" style={{ marginTop: 12 }}>
          <span>{formatMoney(totalCRC, 'CRC')}</span>
          <span>{formatMoney(totalUSD, 'USD')}</span>
        </div>
      </div>

      <div className="section">
        <h3>{t('yourAccounts')}</h3>

        <AddToggle open={showAdd} label={t('addAccount')} onClick={() => setShowAdd((v) => !v)} />
        {showAdd && (
          <div className="add-form">
            <div className="field-grid">
              <Field label={t('name')} span2>
                <input placeholder={t('accountNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label={t('balance')}>
                <input type="number" placeholder={t('balance')} value={balance} onChange={(e) => setBalance(e.target.value)} />
              </Field>
              <Field label={t('currency')}>
                <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                  <option value="CRC">₡ CRC</option>
                  <option value="USD">$ USD</option>
                </select>
              </Field>
            </div>
            <div className="entry-actions">
              <button className="primary" onClick={add}>{t('add')}</button>
            </div>
          </div>
        )}

        {state.accounts.length === 0 ? (
          <p className="muted">{t('noAccountsYet')}</p>
        ) : (
          <div className="entry-list">
            {state.accounts.map((a) => (
              <EntryItem
                key={a.id}
                open={expandedId === a.id}
                onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
                info={
                  <span className="row" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
                    <span className="currency-badge">{a.currency === 'USD' ? '$' : '₡'}</span>
                    <span className="entry-title" style={{ minWidth: 0 }}>{a.name || '—'}</span>
                  </span>
                }
                side={<div className="entry-amount">{formatMoney(a.balance, a.currency)}</div>}
              >
                <div className="field-grid">
                  <Field label={t('name')} span2>
                    <input value={a.name} onChange={(e) => updateAccount(a.id, { name: e.target.value })} />
                  </Field>
                  <Field label={t('balance')}>
                    <input
                      type="number"
                      value={a.balance}
                      onChange={(e) => updateAccount(a.id, { balance: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label={t('currency')}>
                    <select
                      value={a.currency}
                      onChange={(e) => updateAccount(a.id, { currency: e.target.value as Currency })}
                    >
                      <option value="CRC">₡ CRC</option>
                      <option value="USD">$ USD</option>
                    </select>
                  </Field>
                </div>
                <div className="entry-actions">
                  <button className="danger" onClick={() => remove(a.id)}>{t('remove')}</button>
                </div>
              </EntryItem>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
