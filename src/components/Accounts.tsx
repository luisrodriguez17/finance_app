import { useState } from 'react';
import type { Account, AppState, Currency } from '../types';
import { formatMoney, uid, convert } from '../utils';
import type { T } from '../i18n';

type Props = {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
  t: T;
};

export default function Accounts({ state, update, t }: Props) {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState<Currency>(state.primaryCurrency);

  const add = () => {
    if (!name) return;
    const acc: Account = { id: uid(), name, balance: Number(balance) || 0, currency };
    update((s) => ({ ...s, accounts: [...s.accounts, acc] }));
    setName('');
    setBalance('');
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

      <div className="cards">
        <div className="card">
          <h3>{t('crcTotal')}</h3>
          <div className="value">{formatMoney(totalCRC, 'CRC')}</div>
        </div>
        <div className="card">
          <h3>{t('usdTotal')}</h3>
          <div className="value">{formatMoney(totalUSD, 'USD')}</div>
        </div>
      </div>

      <div className="section">
        <h3>{t('addAccount')}</h3>
        <div className="form-grid">
          <input placeholder={t('accountNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
          <input type="number" placeholder={t('balance')} value={balance} onChange={(e) => setBalance(e.target.value)} />
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            <option value="CRC">₡ CRC</option>
            <option value="USD">$ USD</option>
          </select>
          <button className="primary" onClick={add}>{t('add')}</button>
        </div>
      </div>

      <div className="section">
        <h3>{t('yourAccounts')}</h3>
        {state.accounts.length === 0 ? (
          <p className="muted">{t('noAccountsYet')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('balance')}</th>
                <th>{t('currency')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.accounts.map((a) => (
                <tr key={a.id}>
                  <td data-label={t('name')}>
                    <span className="row" style={{ flex: 1, minWidth: 0 }}>
                      <span className="currency-badge">{a.currency === 'USD' ? '$' : '₡'}</span>
                      <input
                        value={a.name}
                        onChange={(e) => updateAccount(a.id, { name: e.target.value })}
                        style={{ flex: 1, minWidth: 0 }}
                      />
                    </span>
                  </td>
                  <td data-label={t('balance')}>
                    <input
                      type="number"
                      value={a.balance}
                      onChange={(e) => updateAccount(a.id, { balance: Number(e.target.value) })}
                      style={{ width: 140 }}
                    />
                  </td>
                  <td data-label={t('currency')}>
                    <select
                      value={a.currency}
                      onChange={(e) => updateAccount(a.id, { currency: e.target.value as Currency })}
                    >
                      <option value="CRC">₡ CRC</option>
                      <option value="USD">$ USD</option>
                    </select>
                  </td>
                  <td>
                    <button className="danger" onClick={() => remove(a.id)}>{t('remove')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
