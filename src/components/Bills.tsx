import { useState } from 'react';
import type { AppState, Bill, Currency, MonthSnapshot, Subscription } from '../types';
import { formatMoney, uid, convert } from '../utils';
import { ensureMonth } from '../store';
import type { T } from '../i18n';
import { AddToggle, CollapsibleSection, EntryItem, Field } from './ui';

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
      <BillsSummary state={state} month={month} t={t} />
      <MonthBillsSection state={state} month={month} update={update} t={t} />
      <SubscriptionsSection state={state} update={update} monthKey={month.monthKey} t={t} />
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

function BillsSummary({ state, month, t }: { state: AppState; month: MonthSnapshot; t: T }) {
  if (month.bills.length === 0) return null;

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

  const fullTotal = combine(totalCRC, totalUSD);
  const paidTotal = combine(paidCRC, paidUSD);
  const paidPct = fullTotal > 0 ? Math.min(100, Math.round((paidTotal / fullTotal) * 100)) : 0;

  return (
    <>
      <div className="hero">
        <div className="hero-label">{t('fullTotal')}</div>
        <div className="hero-value">{formatMoney(fullTotal, primary)}</div>
        <div className="hero-bar">
          <div style={{ width: `${paidPct}%` }} />
          <div style={{ width: `${100 - paidPct}%` }} />
        </div>
        <div className="hero-sub">
          <span>{t('alreadyPaid')}: {formatMoney(paidTotal, primary)}</span>
          <span>{formatMoney(fullTotal - paidTotal, primary)}</span>
        </div>
      </div>

      <div className="cards">
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
      </div>
    </>
  );
}

type BillFilter = 'all' | 'unpaid' | 'paid';

function MonthBillsSection({ state, month, update, t }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<BillFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Add-form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>(state.primaryCurrency);
  const [category, setCategory] = useState(state.categories[0] || 'Other');
  const [creditCardId, setCreditCardId] = useState<string | undefined>(undefined);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [paid, setPaid] = useState(true);
  const [date, setDate] = useState('');

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
      date: date || undefined,
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
    setDate('');
    setShowAdd(false);
  };

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

  const targetName = (b: Bill) =>
    b.creditCardId
      ? state.creditCards.find((c) => c.id === b.creditCardId)?.name
      : b.accountId
        ? state.accounts.find((a) => a.id === b.accountId)?.name
        : undefined;

  const unpaidCount = month.bills.filter((b) => !b.paid).length;
  const paidCount = month.bills.length - unpaidCount;
  const query = search.trim().toLowerCase();
  const categoriesInMonth = Array.from(new Set(month.bills.map((b) => b.category))).sort();
  const visible = month.bills.filter((b) => {
    if (filter === 'paid' && !b.paid) return false;
    if (filter === 'unpaid' && b.paid) return false;
    if (categoryFilter && b.category !== categoryFilter) return false;
    if (!query) return true;
    const haystack = [b.name, b.category, targetName(b)].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(query);
  });

  const amountCounts = new Map<string, number>();
  for (const b of month.bills) {
    if (!b.amount) continue;
    const key = `${b.currency}:${b.amount}`;
    amountCounts.set(key, (amountCounts.get(key) || 0) + 1);
  }
  const isDuplicateAmount = (b: Bill) => (amountCounts.get(`${b.currency}:${b.amount}`) || 0) > 1;

  return (
    <div className="section">
      <h3>{t('billsThisMonth')}</h3>

      <AddToggle open={showAdd} label={t('addABill')} onClick={() => setShowAdd((v) => !v)} />
      {showAdd && (
        <div className="add-form">
          <div className="field-grid">
            <Field label={t('name')} span2>
              <input placeholder={t('billNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t('amount')}>
              <input type="number" placeholder={t('amount')} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label={t('currency')}>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                <option value="CRC">₡ CRC</option>
                <option value="USD">$ USD</option>
              </select>
            </Field>
            <Field label={t('category')} span2>
              <CategorySelect state={state} update={update} value={category} onChange={setCategory} t={t} />
            </Field>
            <Field label={t('card')}>
              <CardSelect state={state} value={creditCardId} disabled={!!accountId} onChange={setCreditCardId} t={t} />
            </Field>
            <Field label={t('account')}>
              <AccountSelect state={state} value={accountId} disabled={!!creditCardId} onChange={setAccountId} t={t} />
            </Field>
            <Field label={t('date')}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <div className="entry-actions" style={{ justifyContent: 'space-between' }}>
            <label className="row" style={{ cursor: 'pointer' }}>
              <input type="checkbox" className="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
              <span>{t('paid')}</span>
            </label>
            <button className="primary" onClick={add}>{t('addBill')}</button>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>{t('billsHelp')}</p>
        </div>
      )}

      {month.bills.length === 0 ? (
        <p className="muted">{t('noBillsThisMonth')}</p>
      ) : (
        <>
          <input
            type="search"
            className="search-input"
            placeholder={t('searchBillsPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="chip-row">
            <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
              {t('filterAll')} · {month.bills.length}
            </button>
            <button className={`chip ${filter === 'unpaid' ? 'active' : ''}`} onClick={() => setFilter('unpaid')}>
              {t('unpaid')} · {unpaidCount}
            </button>
            <button className={`chip ${filter === 'paid' ? 'active' : ''}`} onClick={() => setFilter('paid')}>
              {t('paid')} · {paidCount}
            </button>
          </div>

          {categoriesInMonth.length > 1 && (
            <select
              className="search-input"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">{t('allCategoriesOpt')}</option>
              {categoriesInMonth.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {visible.length === 0 ? (
            <p className="muted">{t('noBillsMatchFilter')}</p>
          ) : (
            <div className="entry-list">
              {visible.map((b) => (
                <EntryItem
                  key={b.id}
                  open={expandedId === b.id}
                  onToggle={() => setExpandedId(expandedId === b.id ? null : b.id)}
                  info={
                    <>
                      <div className="entry-title">{b.name || '—'}</div>
                      <div className="entry-meta">
                        <span className="tag">{b.category}</span>
                        {b.source === 'subscription' && (
                          <span className="tag sub">{t('sourceSubscription')}</span>
                        )}
                        {targetName(b) && <span>{targetName(b)}</span>}
                        {b.date && <span>{b.date}</span>}
                      </div>
                    </>
                  }
                  side={
                    <>
                      <div className="entry-amount">
                        {isDuplicateAmount(b) && (
                          <span className="dup-dot" title={t('duplicateAmountWarning')} />
                        )}
                        {formatMoney(b.amount, b.currency)}
                      </div>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={b.paid}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => togglePaid(b.id)}
                        title={t('paid')}
                      />
                    </>
                  }
                >
                  <div className="field-grid">
                    <Field label={t('name')} span2>
                      <input value={b.name} onChange={(e) => patchBill(b.id, { name: e.target.value })} />
                    </Field>
                    <Field label={t('amount')}>
                      <input
                        type="number"
                        value={b.amount}
                        disabled={b.paid && !!b.settledFrom}
                        onChange={(e) => patchBill(b.id, { amount: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label={t('currency')}>
                      <select
                        value={b.currency}
                        disabled={b.paid && !!b.settledFrom}
                        onChange={(e) => patchBill(b.id, { currency: e.target.value as Currency })}
                      >
                        <option value="CRC">₡ CRC</option>
                        <option value="USD">$ USD</option>
                      </select>
                    </Field>
                    <Field label={t('category')} span2>
                      <CategorySelect
                        state={state}
                        update={update}
                        value={b.category}
                        onChange={(v) => patchBill(b.id, { category: v })}
                        t={t}
                      />
                    </Field>
                    <Field label={t('card')}>
                      <CardSelect
                        state={state}
                        value={b.creditCardId}
                        disabled={!!b.accountId || b.paid}
                        onChange={(v) => patchBill(b.id, { creditCardId: v })}
                        t={t}
                      />
                    </Field>
                    <Field label={t('account')}>
                      <AccountSelect
                        state={state}
                        value={b.accountId}
                        disabled={!!b.creditCardId || b.paid}
                        onChange={(v) => patchBill(b.id, { accountId: v })}
                        t={t}
                      />
                    </Field>
                    <Field label={t('date')}>
                      <input
                        type="date"
                        value={b.date || ''}
                        onChange={(e) => patchBill(b.id, { date: e.target.value || undefined })}
                      />
                    </Field>
                  </div>
                  {isDuplicateAmount(b) && (
                    <p className="muted dup-note">{t('duplicateAmountWarning')}</p>
                  )}
                  <div className="entry-actions">
                    <button className="danger" onClick={() => remove(b.id)}>{t('remove')}</button>
                  </div>
                </EntryItem>
              ))}
            </div>
          )}
          <p className="muted" style={{ marginTop: 10 }}>{t('tapToEdit')} {t('billsListHelp')}</p>
        </>
      )}
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
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    setShowAdd(false);
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

  const freqLabel = (n?: number) =>
    n === 2 ? t('freqEvery2Short')
    : n === 3 ? t('freqQuarterly')
    : n === 6 ? t('freqEvery6Short')
    : n === 12 ? t('freqYearly')
    : t('freqMonthly');

  const activeCount = state.subscriptions.filter((s) => s.active).length;
  const summary =
    state.subscriptions.length === 0
      ? t('noSubscriptionsYet')
      : `${t('subscriptionsCount', { n: state.subscriptions.length })} · ${t('activeCount', { n: activeCount })}`;

  return (
    <CollapsibleSection title={t('subscriptionsTitle')} summary={summary} open={open} onToggle={() => setOpen((v) => !v)}>
      <AddToggle open={showAdd} label={t('addSubscription')} onClick={() => setShowAdd((v) => !v)} />
      {showAdd && (
        <div className="add-form">
          <div className="field-grid">
            <Field label={t('name')} span2>
              <input placeholder={t('subscriptionNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t('amount')}>
              <input type="number" placeholder={t('amount')} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label={t('currency')}>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                <option value="CRC">₡ CRC</option>
                <option value="USD">$ USD</option>
              </select>
            </Field>
            <Field label={t('category')} span2>
              <CategorySelect state={state} update={update} value={category} onChange={setCategory} t={t} />
            </Field>
            <Field label={t('card')}>
              <CardSelect state={state} value={creditCardId} disabled={!!accountId} onChange={setCreditCardId} t={t} />
            </Field>
            <Field label={t('account')}>
              <AccountSelect state={state} value={accountId} disabled={!!creditCardId} onChange={setAccountId} t={t} />
            </Field>
            <Field label={t('frequency')}>
              <select value={frequencyMonths} onChange={(e) => setFrequencyMonths(Number(e.target.value))}>
                <option value={1}>{t('freqMonthly')}</option>
                <option value={2}>{t('freqEvery2')}</option>
                <option value={3}>{t('freqQuarterly')}</option>
                <option value={6}>{t('freqEvery6')}</option>
                <option value={12}>{t('freqYearly')}</option>
              </select>
            </Field>
            <Field label={t('months')}>
              <input
                type="number"
                min="1"
                placeholder="∞"
                value={totalMonths}
                onChange={(e) => setTotalMonths(e.target.value)}
              />
            </Field>
          </div>
          <div className="entry-actions">
            <button className="primary" onClick={add}>{t('addSubscription')}</button>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>{t('subscriptionsHelp')}</p>
        </div>
      )}

      {state.subscriptions.length > 0 && (
        <div className="entry-list">
          {state.subscriptions.map((s) => (
            <EntryItem
              key={s.id}
              open={expandedId === s.id}
              onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
              info={
                <>
                  <div className="entry-title">{s.name}</div>
                  <div className="entry-meta">
                    <span className="tag">{s.category}</span>
                    <span>{freqLabel(s.frequencyMonths)}</span>
                    {!s.active && <span className="tag sub">{t('inactive')}</span>}
                  </div>
                </>
              }
              side={
                <>
                  <div className="entry-amount">{formatMoney(s.amount, s.currency)}</div>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={s.active}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggle(s.id)}
                    title={t('active')}
                  />
                </>
              }
            >
              <div className="field-grid">
                <Field label={t('name')} span2>
                  <input value={s.name} onChange={(e) => updateSub(s.id, { name: e.target.value })} />
                </Field>
                <Field label={t('amount')}>
                  <input
                    type="number"
                    value={s.amount}
                    onChange={(e) => updateSub(s.id, { amount: Number(e.target.value) })}
                  />
                </Field>
                <Field label={t('currency')}>
                  <select
                    value={s.currency}
                    onChange={(e) => updateSub(s.id, { currency: e.target.value as Currency })}
                  >
                    <option value="CRC">₡ CRC</option>
                    <option value="USD">$ USD</option>
                  </select>
                </Field>
                <Field label={t('category')} span2>
                  <CategorySelect
                    state={state}
                    update={update}
                    value={s.category}
                    onChange={(v) => updateSub(s.id, { category: v })}
                    t={t}
                  />
                </Field>
                <Field label={t('card')}>
                  <CardSelect
                    state={state}
                    value={s.creditCardId}
                    disabled={!!s.accountId}
                    onChange={(v) => updateSub(s.id, { creditCardId: v })}
                    t={t}
                  />
                </Field>
                <Field label={t('account')}>
                  <AccountSelect
                    state={state}
                    value={s.accountId}
                    disabled={!!s.creditCardId}
                    onChange={(v) => updateSub(s.id, { accountId: v })}
                    t={t}
                  />
                </Field>
                <Field label={t('startMonth')}>
                  <input
                    type="month"
                    value={s.startMonth || ''}
                    onChange={(e) => updateSub(s.id, { startMonth: e.target.value || undefined })}
                  />
                </Field>
                <Field label={t('frequency')}>
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
                </Field>
                <Field label={t('months')}>
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
                  />
                </Field>
              </div>
              <div className="entry-actions">
                <button className="danger" onClick={() => remove(s.id)}>{t('remove')}</button>
              </div>
            </EntryItem>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
