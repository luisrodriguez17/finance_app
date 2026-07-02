import { useState } from 'react';
import type { AppState, Bill, Currency, MonthSnapshot, Subscription } from '../types';
import { formatMoney, uid, convert } from '../utils';
import { ensureMonth } from '../store';
import type { T } from '../i18n';

type Props = {
  state: AppState;
  month: MonthSnapshot;
  update: (u: (s: AppState) => AppState) => void;
  t: T;
};

export default function Bills({ state, month, update, t }: Props) {
  return (
    <div>
      <h2>{t('billsTitle')}</h2>
      <ManualBillsSection state={state} month={month} update={update} t={t} />
      <SubscriptionsSection state={state} update={update} monthKey={month.monthKey} t={t} />
      <BillsList state={state} month={month} update={update} t={t} />
    </div>
  );
}

function CardSelect({
  state,
  value,
  onChange,
  disabled,
  t,
}: {
  state: AppState;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  disabled?: boolean;
  t: T;
}) {
  return (
    <select
      value={value || ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">{t('noCard')}</option>
      {state.creditCards.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}

function AccountSelect({
  state,
  value,
  onChange,
  disabled,
  t,
}: {
  state: AppState;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  disabled?: boolean;
  t: T;
}) {
  return (
    <select
      value={value || ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">{t('noAccount')}</option>
      {state.accounts.map((a) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </select>
  );
}

function adjustAccount(state: AppState, accountId: string, delta: number): AppState {
  return {
    ...state,
    accounts: state.accounts.map((a) =>
      a.id === accountId ? { ...a, balance: a.balance + delta } : a
    ),
  };
}

function CategorySelect({
  state,
  update,
  value,
  onChange,
  t,
}: {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
  value: string;
  onChange: (v: string) => void;
  t: T;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    if (!state.categories.includes(trimmed)) {
      update((s) => ({ ...s, categories: [...s.categories, trimmed] }));
    }
    onChange(trimmed);
    setDraft('');
    setAdding(false);
  };

  if (adding) {
    return (
      <div className="row" style={{ gap: 4 }}>
        <input
          autoFocus
          placeholder={t('newCategory')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setAdding(false); setDraft(''); }
          }}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button type="button" className="primary" style={{ padding: '6px 10px', fontSize: '0.85rem' }} onClick={commit}>
          {t('add')}
        </button>
        <button type="button" className="ghost" onClick={() => { setAdding(false); setDraft(''); }}>
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="row" style={{ gap: 4 }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
        {state.categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <button type="button" className="ghost" onClick={() => setAdding(true)} title={t('addNewCategoryTitle')}>
        +
      </button>
    </div>
  );
}

function ManualBillsSection({ state, month, update, t }: Props) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>(state.primaryCurrency);
  const [category, setCategory] = useState(state.categories[0] || 'Other');
  const [creditCardId, setCreditCardId] = useState<string | undefined>(undefined);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [paid, setPaid] = useState(true);

  const add = () => {
    if (!name || !amount) return;
    const amt = Number(amount);
    const newBill: Bill = {
      id: uid(),
      name,
      amount: amt,
      currency,
      category,
      source: 'manual',
      creditCardId,
      accountId,
      paid,
      settledFrom: paid && accountId ? { accountId, amount: amt, currency } : undefined,
    };

    update((s) => {
      if (paid && accountId) {
        const acc = s.accounts.find((a) => a.id === accountId);
        if (acc && acc.currency !== currency) {
          alert(
            `Account "${acc.name}" is in ${acc.currency} but the bill is in ${currency}. ` +
              `The bill will be added unpaid.`
          );
          const fallback: Bill = { ...newBill, paid: false, settledFrom: undefined };
          return {
            ...s,
            months: {
              ...s.months,
              [month.monthKey]: {
                ...s.months[month.monthKey],
                bills: [...s.months[month.monthKey].bills, fallback],
              },
            },
          };
        }
      }
      let next = s;
      if (paid && accountId) next = adjustAccount(next, accountId, -amt);
      return {
        ...next,
        months: {
          ...next.months,
          [month.monthKey]: {
            ...next.months[month.monthKey],
            bills: [...next.months[month.monthKey].bills, newBill],
          },
        },
      };
    });

    setName('');
    setAmount('');
    setCreditCardId(undefined);
    setAccountId(undefined);
    setPaid(true);
  };

  return (
    <div className="section">
      <h3>{t('addABill')}</h3>
      <div className="form-grid">
        <input placeholder={t('billNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
        <input
          type="number"
          placeholder={t('amount')}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
          <option value="CRC">₡ CRC</option>
          <option value="USD">$ USD</option>
        </select>
        <CategorySelect state={state} update={update} value={category} onChange={setCategory} t={t} />
        <CardSelect state={state} value={creditCardId} disabled={!!accountId} onChange={setCreditCardId} t={t} />
        <AccountSelect state={state} value={accountId} disabled={!!creditCardId} onChange={setAccountId} t={t} />
        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" className="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          <span>{t('paid')}</span>
        </label>
        <button className="primary" onClick={add}>{t('addBill')}</button>
      </div>
      <p className="muted">{t('billsHelp')}</p>
    </div>
  );
}

function SubscriptionsSection({
  state,
  update,
  monthKey,
  t,
}: {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
  monthKey: string;
  t: T;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>(state.primaryCurrency);
  const [category, setCategory] = useState(state.categories[0] || 'Other');
  const [creditCardId, setCreditCardId] = useState<string | undefined>(undefined);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [totalMonths, setTotalMonths] = useState('');
  const [frequencyMonths, setFrequencyMonths] = useState(1);

  const add = () => {
    if (!name || !amount) return;
    const months = Number(totalMonths);
    const sub: Subscription = {
      id: uid(),
      name,
      amount: Number(amount),
      currency,
      category,
      active: true,
      creditCardId,
      accountId,
      startMonth: monthKey,
      totalMonths: totalMonths && months > 0 ? months : undefined,
      frequencyMonths: frequencyMonths !== 1 ? frequencyMonths : undefined,
    };
    update((s) => ensureMonth({ ...s, subscriptions: [...s.subscriptions, sub] }, monthKey));
    setName('');
    setAmount('');
    setCreditCardId(undefined);
    setAccountId(undefined);
    setTotalMonths('');
    setFrequencyMonths(1);
  };

  const updateSub = (id: string, patch: Partial<Subscription>) =>
    update((s) => ({
      ...s,
      subscriptions: s.subscriptions.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));

  const toggle = (id: string) =>
    update((s) => ({
      ...s,
      subscriptions: s.subscriptions.map((x) => (x.id === id ? { ...x, active: !x.active } : x)),
    }));

  const remove = (id: string) =>
    update((s) => ({ ...s, subscriptions: s.subscriptions.filter((x) => x.id !== id) }));

  return (
    <div className="section">
      <h3>{t('subscriptionsTitle')}</h3>
      <div className="form-grid">
        <input placeholder={t('subscriptionNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
        <input
          type="number"
          placeholder={t('amount')}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
          <option value="CRC">₡ CRC</option>
          <option value="USD">$ USD</option>
        </select>
        <CategorySelect state={state} update={update} value={category} onChange={setCategory} t={t} />
        <CardSelect state={state} value={creditCardId} disabled={!!accountId} onChange={setCreditCardId} t={t} />
        <AccountSelect state={state} value={accountId} disabled={!!creditCardId} onChange={setAccountId} t={t} />
        <select
          value={frequencyMonths}
          onChange={(e) => setFrequencyMonths(Number(e.target.value))}
        >
          <option value={1}>{t('freqMonthly')}</option>
          <option value={2}>{t('freqEvery2')}</option>
          <option value={3}>{t('freqQuarterly')}</option>
          <option value={6}>{t('freqEvery6')}</option>
          <option value={12}>{t('freqYearly')}</option>
        </select>
        <input
          type="number"
          min="1"
          placeholder={t('durationPlaceholder')}
          value={totalMonths}
          onChange={(e) => setTotalMonths(e.target.value)}
        />
        <button className="primary" onClick={add}>{t('addSubscription')}</button>
      </div>
      {state.subscriptions.length === 0 ? (
        <p className="muted">{t('noSubscriptionsYet')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('name')}</th>
              <th>{t('amount')}</th>
              <th>{t('category')}</th>
              <th>{t('card')}</th>
              <th>{t('account')}</th>
              <th>{t('startMonth')}</th>
              <th>{t('frequency')}</th>
              <th>{t('months')}</th>
              <th>{t('active')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {state.subscriptions.map((s) => (
              <tr key={s.id}>
                <td data-label={t('name')}>{s.name}</td>
                <td data-label={t('amount')}>{formatMoney(s.amount, s.currency)}</td>
                <td data-label={t('category')}><span className="tag">{s.category}</span></td>
                <td data-label={t('card')}>
                  <CardSelect
                    state={state}
                    value={s.creditCardId}
                    disabled={!!s.accountId}
                    onChange={(v) => updateSub(s.id, { creditCardId: v })}
                    t={t}
                  />
                </td>
                <td data-label={t('account')}>
                  <AccountSelect
                    state={state}
                    value={s.accountId}
                    disabled={!!s.creditCardId}
                    onChange={(v) => updateSub(s.id, { accountId: v })}
                    t={t}
                  />
                </td>
                <td data-label={t('startMonth')}>
                  <input
                    type="month"
                    value={s.startMonth || ''}
                    onChange={(e) =>
                      updateSub(s.id, { startMonth: e.target.value || undefined })
                    }
                    style={{ width: 140 }}
                  />
                </td>
                <td data-label={t('frequency')}>
                  <select
                    value={s.frequencyMonths ?? 1}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      updateSub(s.id, { frequencyMonths: n === 1 ? undefined : n });
                    }}
                  >
                    <option value={1}>{t('freqMonthly')}</option>
                    <option value={2}>{t('freqEvery2Short')}</option>
                    <option value={3}>{t('freqQuarterly')}</option>
                    <option value={6}>{t('freqEvery6Short')}</option>
                    <option value={12}>{t('freqYearly')}</option>
                  </select>
                </td>
                <td data-label={t('months')}>
                  <input
                    type="number"
                    min="1"
                    placeholder="∞"
                    value={s.totalMonths ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const n = Number(v);
                      updateSub(s.id, { totalMonths: v && n > 0 ? n : undefined });
                    }}
                    style={{ width: 80 }}
                  />
                </td>
                <td data-label={t('active')}>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={s.active}
                    onChange={() => toggle(s.id)}
                  />
                </td>
                <td>
                  <button className="danger" onClick={() => remove(s.id)}>{t('remove')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted">{t('subscriptionsHelp')}</p>
    </div>
  );
}

function BillsList({ month, state, update, t }: Props) {
  const patchBill = (id: string, patch: Partial<Bill>) =>
    update((s) => ({
      ...s,
      months: {
        ...s.months,
        [month.monthKey]: {
          ...s.months[month.monthKey],
          bills: s.months[month.monthKey].bills.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        },
      },
    }));

  const togglePaid = (id: string) =>
    update((s) => {
      const monthData = s.months[month.monthKey];
      const bill = monthData.bills.find((b) => b.id === id);
      if (!bill) return s;

      let next = s;

      if (!bill.paid) {
        if (bill.accountId) {
          const acc = s.accounts.find((a) => a.id === bill.accountId);
          if (acc && acc.currency !== bill.currency) {
            alert(
              `Account "${acc.name}" is in ${acc.currency} but the bill is in ${bill.currency}. ` +
                `Convert manually or pick a matching account.`
            );
            return s;
          }
          next = adjustAccount(next, bill.accountId, -bill.amount);
        }
        next = {
          ...next,
          months: {
            ...next.months,
            [month.monthKey]: {
              ...next.months[month.monthKey],
              bills: next.months[month.monthKey].bills.map((b) =>
                b.id === id
                  ? {
                      ...b,
                      paid: true,
                      settledFrom: bill.accountId
                        ? { accountId: bill.accountId, amount: bill.amount, currency: bill.currency }
                        : undefined,
                    }
                  : b
              ),
            },
          },
        };
      } else {
        if (bill.settledFrom) {
          next = adjustAccount(next, bill.settledFrom.accountId, bill.settledFrom.amount);
        }
        next = {
          ...next,
          months: {
            ...next.months,
            [month.monthKey]: {
              ...next.months[month.monthKey],
              bills: next.months[month.monthKey].bills.map((b) =>
                b.id === id ? { ...b, paid: false, settledFrom: undefined } : b
              ),
            },
          },
        };
      }
      return next;
    });

  const remove = (id: string) =>
    update((s) => {
      const bill = s.months[month.monthKey].bills.find((b) => b.id === id);
      let next = s;
      if (bill?.settledFrom) {
        next = adjustAccount(next, bill.settledFrom.accountId, bill.settledFrom.amount);
      }
      return {
        ...next,
        months: {
          ...next.months,
          [month.monthKey]: {
            ...next.months[month.monthKey],
            bills: next.months[month.monthKey].bills.filter((b) => b.id !== id),
          },
        },
      };
    });

  if (month.bills.length === 0) {
    return (
      <div className="section">
        <p className="muted">{t('noBillsThisMonth')}</p>
      </div>
    );
  }

  const primary = state.primaryCurrency;
  const rate = state.exchangeRate;
  const sumBy = (bills: Bill[], cur: Currency) =>
    bills.filter((b) => b.currency === cur).reduce((s, b) => s + b.amount, 0);
  const combine = (crc: number, usd: number) =>
    convert(crc, 'CRC', primary, rate) + convert(usd, 'USD', primary, rate);

  const accountBills = month.bills.filter((b) => !b.creditCardId && !b.settledFrom);
  const accountCRC = sumBy(accountBills, 'CRC');
  const accountUSD = sumBy(accountBills, 'USD');

  const cardBills = month.bills.filter((b) => b.creditCardId);
  const cardCRC = sumBy(cardBills, 'CRC');
  const cardUSD = sumBy(cardBills, 'USD');

  const totalCRC = accountCRC + cardCRC;
  const totalUSD = accountUSD + cardUSD;

  const paidBills = month.bills.filter((b) => b.settledFrom);
  const paidCRC = sumBy(paidBills, 'CRC');
  const paidUSD = sumBy(paidBills, 'USD');

  return (
    <div className="section">
      <h3>{t('billsThisMonth')}</h3>
      <div className="cards" style={{ marginBottom: 12 }}>
        <div className="card">
          <h3>{t('accountBills')}</h3>
          <div className="value">{formatMoney(combine(accountCRC, accountUSD), primary)}</div>
          <div className="sub">
            {formatMoney(accountCRC, 'CRC')} · {formatMoney(accountUSD, 'USD')}
          </div>
        </div>
        <div className="card">
          <h3>{t('creditCardBills')}</h3>
          <div className="value">{formatMoney(combine(cardCRC, cardUSD), primary)}</div>
          <div className="sub">
            {formatMoney(cardCRC, 'CRC')} · {formatMoney(cardUSD, 'USD')}
          </div>
        </div>
        <div className="card">
          <h3>{t('fullTotal')}</h3>
          <div className="value">{formatMoney(combine(totalCRC, totalUSD), primary)}</div>
          <div className="sub">
            {formatMoney(totalCRC, 'CRC')} · {formatMoney(totalUSD, 'USD')}
          </div>
        </div>
        <div className="card">
          <h3>{t('alreadyPaid')}</h3>
          <div className="value">{formatMoney(combine(paidCRC, paidUSD), primary)}</div>
          <div className="sub">
            {formatMoney(paidCRC, 'CRC')} · {formatMoney(paidUSD, 'USD')}
          </div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>{t('name')}</th>
            <th>{t('amount')}</th>
            <th>{t('currency')}</th>
            <th>{t('category')}</th>
            <th>{t('card')}</th>
            <th>{t('account')}</th>
            <th>{t('type')}</th>
            <th>{t('paid')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {month.bills.map((b) => (
            <tr key={b.id} style={{ opacity: b.creditCardId ? 0.85 : 1 }}>
              <td data-label={t('name')}>
                <input
                  value={b.name}
                  onChange={(e) => patchBill(b.id, { name: e.target.value })}
                  style={{ width: 140 }}
                />
              </td>
              <td data-label={t('amount')}>
                <input
                  type="number"
                  value={b.amount}
                  disabled={b.paid && !!b.settledFrom}
                  onChange={(e) => patchBill(b.id, { amount: Number(e.target.value) })}
                  style={{ width: 110 }}
                />
              </td>
              <td data-label={t('currency')}>
                <select
                  value={b.currency}
                  disabled={b.paid && !!b.settledFrom}
                  onChange={(e) => patchBill(b.id, { currency: e.target.value as Currency })}
                >
                  <option value="CRC">₡ CRC</option>
                  <option value="USD">$ USD</option>
                </select>
              </td>
              <td data-label={t('category')}>
                <CategorySelect
                  state={state}
                  update={update}
                  value={b.category}
                  onChange={(v) => patchBill(b.id, { category: v })}
                  t={t}
                />
              </td>
              <td data-label={t('card')}>
                <CardSelect
                  state={state}
                  value={b.creditCardId}
                  disabled={!!b.accountId || b.paid}
                  onChange={(v) => patchBill(b.id, { creditCardId: v })}
                  t={t}
                />
              </td>
              <td data-label={t('account')}>
                <AccountSelect
                  state={state}
                  value={b.accountId}
                  disabled={!!b.creditCardId || b.paid}
                  onChange={(v) => patchBill(b.id, { accountId: v })}
                  t={t}
                />
              </td>
              <td data-label={t('type')}>
                <span className={`tag ${b.source === 'subscription' ? 'sub' : ''}`}>
                  {b.source}
                </span>
              </td>
              <td data-label={t('paid')}>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={b.paid}
                  onChange={() => togglePaid(b.id)}
                />
              </td>
              <td>
                <button className="danger" onClick={() => remove(b.id)}>{t('remove')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">{t('billsListHelp')}</p>
    </div>
  );
}
