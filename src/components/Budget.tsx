import { useState } from 'react';
import type { AppState, BudgetSlice, Currency, MonthSnapshot, SavingsReserve } from '../types';
import { formatMoney, uid, convert } from '../utils';
import type { T } from '../i18n';

type Props = {
  state: AppState;
  month: MonthSnapshot;
  update: (u: (s: AppState) => AppState) => void;
  t: T;
};

export const computeReserve = (r: SavingsReserve, balanceCRC: number, balanceUSD: number) => {
  const base = r.currency === 'CRC' ? balanceCRC : balanceUSD;
  return r.mode === 'percent' ? base * (r.value / 100) : r.value;
};

export default function Budget({ state, month, update, t }: Props) {
  return (
    <div>
      <h2>{t('budgetTitle')}</h2>
      <SalaryAllocations state={state} month={month} update={update} t={t} />
      <Reserves state={state} update={update} t={t} />
    </div>
  );
}

function SalaryAllocations({ state, month, update, t }: Props) {
  const [name, setName] = useState('');
  const [pct, setPct] = useState('');

  const add = () => {
    if (!name || !pct) return;
    const slice: BudgetSlice = { id: uid(), name, percentage: Number(pct) };
    update((s) => ({ ...s, budget: [...s.budget, slice] }));
    setName('');
    setPct('');
  };

  const updatePct = (id: string, percentage: number) =>
    update((s) => ({
      ...s,
      budget: s.budget.map((b) => (b.id === id ? { ...b, percentage } : b)),
    }));

  const remove = (id: string) =>
    update((s) => ({ ...s, budget: s.budget.filter((b) => b.id !== id) }));

  const totalPct = state.budget.reduce((s, b) => s + b.percentage, 0);
  const salary = convert(month.salary.amount, month.salary.currency, state.primaryCurrency, state.exchangeRate);

  return (
    <>
      <p className="muted">{t('salaryAllocationsIntro', { cur: state.primaryCurrency })}</p>

      <div className="section">
        <h3>{t('addSalaryAllocation')}</h3>
        <div className="form-grid">
          <input placeholder={t('name')} value={name} onChange={(e) => setName(e.target.value)} />
          <input type="number" placeholder="%" value={pct} onChange={(e) => setPct(e.target.value)} />
          <button className="primary" onClick={add}>{t('add')}</button>
        </div>
      </div>

      <div className="section">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>{t('salaryAllocations')}</h3>
          <span className={`tag ${totalPct > 100 ? 'sub' : ''}`}>{t('pctAllocated', { n: totalPct })}</span>
        </div>
        {state.budget.length === 0 ? (
          <p className="muted">{t('noAllocationsYet')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('percentage')}</th>
                <th>{t('amount')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.budget.map((b) => (
                <tr key={b.id}>
                  <td data-label={t('name')}>{b.name}</td>
                  <td data-label={t('percentage')}>
                    <input
                      type="number"
                      value={b.percentage}
                      onChange={(e) => updatePct(b.id, Number(e.target.value))}
                      style={{ width: 80 }}
                    />{' '}
                    %
                    <div className="budget-bar">
                      <div style={{ width: `${Math.min(100, b.percentage)}%` }} />
                    </div>
                  </td>
                  <td data-label={t('amount')}>{formatMoney(salary * (b.percentage / 100), state.primaryCurrency)}</td>
                  <td>
                    <button className="danger" onClick={() => remove(b.id)}>{t('remove')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Reserves({
  state,
  update,
  t,
}: {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
  t: T;
}) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState<Currency>(state.primaryCurrency);

  const balanceCRC = state.accounts.filter((a) => a.currency === 'CRC').reduce((s, a) => s + a.balance, 0);
  const balanceUSD = state.accounts.filter((a) => a.currency === 'USD').reduce((s, a) => s + a.balance, 0);

  const add = () => {
    if (!name || !value) return;
    const r: SavingsReserve = { id: uid(), name, mode, value: Number(value), currency };
    update((s) => ({ ...s, reserves: [...s.reserves, r] }));
    setName('');
    setValue('');
  };

  const updateReserve = (id: string, patch: Partial<SavingsReserve>) =>
    update((s) => ({
      ...s,
      reserves: s.reserves.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));

  const remove = (id: string) =>
    update((s) => ({ ...s, reserves: s.reserves.filter((r) => r.id !== id) }));

  const reservedCRC = state.reserves
    .filter((r) => r.currency === 'CRC')
    .reduce((s, r) => s + computeReserve(r, balanceCRC, balanceUSD), 0);
  const reservedUSD = state.reserves
    .filter((r) => r.currency === 'USD')
    .reduce((s, r) => s + computeReserve(r, balanceCRC, balanceUSD), 0);

  return (
    <>
      <h3 style={{ marginTop: 32 }}>{t('savingsReservesTitle')}</h3>
      <p className="muted">{t('reservesIntro')}</p>

      <div className="cards">
        <div className="card">
          <h3>{t('reservedCRC')}</h3>
          <div className="value">{formatMoney(reservedCRC, 'CRC')}</div>
          <div className="sub">{t('ofXBalance', { amount: formatMoney(balanceCRC, 'CRC') })}</div>
        </div>
        <div className="card">
          <h3>{t('reservedUSD')}</h3>
          <div className="value">{formatMoney(reservedUSD, 'USD')}</div>
          <div className="sub">{t('ofXBalance', { amount: formatMoney(balanceUSD, 'USD') })}</div>
        </div>
      </div>

      <div className="section">
        <h3>{t('addReserve')}</h3>
        <div className="form-grid">
          <input placeholder={t('reserveNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
          <select value={mode} onChange={(e) => setMode(e.target.value as 'percent' | 'fixed')}>
            <option value="percent">{t('modePercent')}</option>
            <option value="fixed">{t('modeFixed')}</option>
          </select>
          <input
            type="number"
            placeholder={mode === 'percent' ? '%' : t('amount')}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            <option value="CRC">₡ CRC</option>
            <option value="USD">$ USD</option>
          </select>
          <button className="primary" onClick={add}>{t('add')}</button>
        </div>
      </div>

      <div className="section">
        <h3>{t('yourReserves')}</h3>
        {state.reserves.length === 0 ? (
          <p className="muted">{t('noReservesYet')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('mode')}</th>
                <th>{t('value')}</th>
                <th>{t('currency')}</th>
                <th>{t('reservedAmount')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.reserves.map((r) => (
                <tr key={r.id}>
                  <td data-label={t('name')}>
                    <input value={r.name} onChange={(e) => updateReserve(r.id, { name: e.target.value })} />
                  </td>
                  <td data-label={t('mode')}>
                    <select
                      value={r.mode}
                      onChange={(e) => updateReserve(r.id, { mode: e.target.value as 'percent' | 'fixed' })}
                    >
                      <option value="percent">{t('modePercent')}</option>
                      <option value="fixed">{t('modeFixed')}</option>
                    </select>
                  </td>
                  <td data-label={t('value')}>
                    <input
                      type="number"
                      value={r.value}
                      onChange={(e) => updateReserve(r.id, { value: Number(e.target.value) })}
                      style={{ width: 100 }}
                    />
                    {r.mode === 'percent' ? ' %' : ''}
                  </td>
                  <td data-label={t('currency')}>
                    <select
                      value={r.currency}
                      onChange={(e) => updateReserve(r.id, { currency: e.target.value as Currency })}
                    >
                      <option value="CRC">₡ CRC</option>
                      <option value="USD">$ USD</option>
                    </select>
                  </td>
                  <td data-label={t('reservedAmount')}>{formatMoney(computeReserve(r, balanceCRC, balanceUSD), r.currency)}</td>
                  <td>
                    <button className="danger" onClick={() => remove(r.id)}>{t('remove')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
