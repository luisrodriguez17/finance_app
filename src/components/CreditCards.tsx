import { useState } from 'react';
import type { AppState, Bill, CreditCard } from '../types';
import { formatMoney, uid, convert } from '../utils';
import { currentMonthKey, ensureMonth } from '../store';
import type { T } from '../i18n';
import { AddToggle, EntryItem, Field } from './ui';

type Props = {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
  t: T;
};

export default function CreditCards({ state, update, t }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [owedCRC, setOwedCRC] = useState('');
  const [owedUSD, setOwedUSD] = useState('');

  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [realCRC, setRealCRC] = useState('');
  const [realUSD, setRealUSD] = useState('');

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payCurrency, setPayCurrency] = useState<'CRC' | 'USD'>('CRC');

  const add = () => {
    if (!name) return;
    const card: CreditCard = {
      id: uid(),
      name,
      owedCRC: Number(owedCRC) || 0,
      owedUSD: Number(owedUSD) || 0,
    };
    update((s) => ({ ...s, creditCards: [...s.creditCards, card] }));
    setName('');
    setOwedCRC('');
    setOwedUSD('');
    setShowAdd(false);
  };

  const updateCard = (id: string, patch: Partial<CreditCard>) =>
    update((s) => ({
      ...s,
      creditCards: s.creditCards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));

  const remove = (id: string) =>
    update((s) => ({ ...s, creditCards: s.creditCards.filter((c) => c.id !== id) }));

  const cardBillsByCard = (cardId: string, currency: 'CRC' | 'USD') =>
    Object.values(state.months)
      .flatMap((m) => m.bills)
      .filter((b) => b.creditCardId === cardId && b.currency === currency)
      .reduce((s, b) => s + b.amount, 0);

  const startCorrection = (c: CreditCard) => {
    const totalCRC = c.owedCRC + cardBillsByCard(c.id, 'CRC');
    const totalUSD = c.owedUSD + cardBillsByCard(c.id, 'USD');
    setCorrectingId(c.id);
    setRealCRC(String(totalCRC));
    setRealUSD(String(totalUSD));
  };

  const cancelCorrection = () => {
    setCorrectingId(null);
    setRealCRC('');
    setRealUSD('');
  };

  const startPayment = (c: CreditCard) => {
    setPayingId(c.id);
    setPayAmount('');
    setPayCurrency(c.owedCRC === 0 && c.owedUSD !== 0 ? 'USD' : 'CRC');
  };

  const cancelPayment = () => {
    setPayingId(null);
    setPayAmount('');
  };

  const applyPayment = (c: CreditCard) => {
    const value = Number(payAmount);
    if (!value) {
      cancelPayment();
      return;
    }
    if (payCurrency === 'CRC') {
      updateCard(c.id, { owedCRC: c.owedCRC - value });
    } else {
      updateCard(c.id, { owedUSD: c.owedUSD - value });
    }
    cancelPayment();
  };

  const applyCorrection = (c: CreditCard) => {
    const currentCRC = c.owedCRC + cardBillsByCard(c.id, 'CRC');
    const currentUSD = c.owedUSD + cardBillsByCard(c.id, 'USD');
    const deltaCRC = Number(realCRC) - currentCRC;
    const deltaUSD = Number(realUSD) - currentUSD;

    const category = state.categories.includes('Other')
      ? 'Other'
      : state.categories[0] || 'Other';

    const offsets: Bill[] = [];
    if (Math.abs(deltaCRC) > 0.001) {
      offsets.push({
        id: uid(),
        name: `Offset (${c.name})`,
        amount: deltaCRC,
        currency: 'CRC',
        category,
        source: 'manual',
        creditCardId: c.id,
        paid: false,
      });
    }
    if (Math.abs(deltaUSD) > 0.001) {
      offsets.push({
        id: uid(),
        name: `Offset (${c.name})`,
        amount: deltaUSD,
        currency: 'USD',
        category,
        source: 'manual',
        creditCardId: c.id,
        paid: false,
      });
    }

    if (offsets.length === 0) {
      cancelCorrection();
      return;
    }

    update((s) => {
      const key = currentMonthKey();
      const ensured = ensureMonth(s, key);
      return {
        ...ensured,
        months: {
          ...ensured.months,
          [key]: {
            ...ensured.months[key],
            bills: [...ensured.months[key].bills, ...offsets],
          },
        },
      };
    });
    cancelCorrection();
  };

  const totalCRC =
    state.creditCards.reduce((s, c) => s + c.owedCRC, 0) +
    state.creditCards.reduce((s, c) => s + cardBillsByCard(c.id, 'CRC'), 0);
  const totalUSD =
    state.creditCards.reduce((s, c) => s + c.owedUSD, 0) +
    state.creditCards.reduce((s, c) => s + cardBillsByCard(c.id, 'USD'), 0);
  const combined =
    convert(totalCRC, 'CRC', state.primaryCurrency, state.exchangeRate) +
    convert(totalUSD, 'USD', state.primaryCurrency, state.exchangeRate);

  return (
    <div>
      <h2>{t('cardsTitle')}</h2>
      <p className="muted">{t('cardsIntro')}</p>

      <div className="hero debt">
        <div className="hero-label">{t('combinedTotal', { cur: state.primaryCurrency })}</div>
        <div className="hero-value negative">{formatMoney(combined, state.primaryCurrency)}</div>
        <div className="hero-sub" style={{ marginTop: 12 }}>
          <span>{formatMoney(totalCRC, 'CRC')}</span>
          <span>{formatMoney(totalUSD, 'USD')}</span>
        </div>
      </div>

      <div className="section">
        <h3>{t('yourCards')}</h3>

        <AddToggle open={showAdd} label={t('addCard')} onClick={() => setShowAdd((v) => !v)} />
        {showAdd && (
          <div className="add-form">
            <div className="field-grid">
              <Field label={t('name')} span2>
                <input placeholder={t('cardNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label={t('owedInCRC')}>
                <input type="number" value={owedCRC} onChange={(e) => setOwedCRC(e.target.value)} />
              </Field>
              <Field label={t('owedInUSD')}>
                <input type="number" value={owedUSD} onChange={(e) => setOwedUSD(e.target.value)} />
              </Field>
            </div>
            <div className="entry-actions">
              <button className="primary" onClick={add}>{t('add')}</button>
            </div>
          </div>
        )}

        {state.creditCards.length === 0 ? (
          <p className="muted">{t('noCardsYet')}</p>
        ) : (
          <>
            <div className="entry-list">
              {state.creditCards.map((c) => {
                const fromBillsCRC = cardBillsByCard(c.id, 'CRC');
                const fromBillsUSD = cardBillsByCard(c.id, 'USD');
                const totalCardCRC = c.owedCRC + fromBillsCRC;
                const totalCardUSD = c.owedUSD + fromBillsUSD;
                const isCorrecting = correctingId === c.id;
                const previewDeltaCRC = isCorrecting ? Number(realCRC) - totalCardCRC : 0;
                const previewDeltaUSD = isCorrecting ? Number(realUSD) - totalCardUSD : 0;
                const isPaying = payingId === c.id;
                return (
                  <EntryItem
                    key={c.id}
                    open={expandedId === c.id}
                    onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    info={
                      <>
                        <div className="entry-title">{c.name || '—'}</div>
                        <div className="entry-meta">
                          <span>
                            {t('fromBills')}: {formatMoney(fromBillsCRC, 'CRC')} · {formatMoney(fromBillsUSD, 'USD')}
                          </span>
                        </div>
                      </>
                    }
                    side={
                      <>
                        {totalCardCRC !== 0 && <div className="entry-amount">{formatMoney(totalCardCRC, 'CRC')}</div>}
                        {totalCardUSD !== 0 && <div className="entry-amount">{formatMoney(totalCardUSD, 'USD')}</div>}
                        {totalCardCRC === 0 && totalCardUSD === 0 && <div className="entry-amount muted">—</div>}
                      </>
                    }
                  >
                    <div className="field-grid">
                      <Field label={t('name')} span2>
                        <input value={c.name} onChange={(e) => updateCard(c.id, { name: e.target.value })} />
                      </Field>
                      <Field label={t('manualCRC')}>
                        <input
                          type="number"
                          value={c.owedCRC}
                          onChange={(e) => updateCard(c.id, { owedCRC: Number(e.target.value) })}
                        />
                      </Field>
                      <Field label={t('manualUSD')}>
                        <input
                          type="number"
                          value={c.owedUSD}
                          onChange={(e) => updateCard(c.id, { owedUSD: Number(e.target.value) })}
                        />
                      </Field>
                      <Field label={t('fromBillsCRC')}>
                        <span className="entry-amount muted">{formatMoney(fromBillsCRC, 'CRC')}</span>
                      </Field>
                      <Field label={t('fromBillsUSD')}>
                        <span className="entry-amount muted">{formatMoney(fromBillsUSD, 'USD')}</span>
                      </Field>
                      <Field label={t('totalCRC')}>
                        <span className="entry-amount">{formatMoney(totalCardCRC, 'CRC')}</span>
                      </Field>
                      <Field label={t('totalUSD')}>
                        <span className="entry-amount">{formatMoney(totalCardUSD, 'USD')}</span>
                      </Field>
                    </div>

                    {isCorrecting && (
                      <>
                        <p className="muted" style={{ marginBottom: 0 }}>{t('correctionPrompt')}</p>
                        <div className="field-grid">
                          <Field label={t('realCRC')}>
                            <input type="number" value={realCRC} onChange={(e) => setRealCRC(e.target.value)} />
                          </Field>
                          <Field label={t('realUSD')}>
                            <input type="number" value={realUSD} onChange={(e) => setRealUSD(e.target.value)} />
                          </Field>
                          <span className={previewDeltaCRC === 0 ? 'muted' : previewDeltaCRC > 0 ? 'value negative' : 'value positive'}>
                            Δ {formatMoney(previewDeltaCRC, 'CRC')}
                          </span>
                          <span className={previewDeltaUSD === 0 ? 'muted' : previewDeltaUSD > 0 ? 'value negative' : 'value positive'}>
                            Δ {formatMoney(previewDeltaUSD, 'USD')}
                          </span>
                        </div>
                      </>
                    )}

                    {isPaying && (
                      <>
                        <p className="muted" style={{ marginBottom: 0 }}>{t('paymentPrompt')}</p>
                        <div className="field-grid">
                          <Field label={t('amount')}>
                            <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                          </Field>
                          <Field label={t('currency')}>
                            <select value={payCurrency} onChange={(e) => setPayCurrency(e.target.value as 'CRC' | 'USD')}>
                              <option value="CRC">₡ CRC</option>
                              <option value="USD">$ USD</option>
                            </select>
                          </Field>
                        </div>
                      </>
                    )}

                    <div className="entry-actions">
                      {isCorrecting ? (
                        <>
                          <button className="ghost" onClick={cancelCorrection}>{t('cancel')}</button>
                          <button className="primary" onClick={() => applyCorrection(c)}>{t('createOffset')}</button>
                        </>
                      ) : isPaying ? (
                        <>
                          <button className="ghost" onClick={cancelPayment}>{t('cancel')}</button>
                          <button className="primary" onClick={() => applyPayment(c)}>{t('makePayment')}</button>
                        </>
                      ) : (
                        <>
                          <button className="ghost" onClick={() => startPayment(c)}>{t('pay')}</button>
                          <button className="ghost" onClick={() => startCorrection(c)}>{t('correct')}</button>
                          <button className="danger" onClick={() => remove(c.id)}>{t('remove')}</button>
                        </>
                      )}
                    </div>
                  </EntryItem>
                );
              })}
            </div>
            <p className="muted" style={{ marginTop: 10 }}>{t('cardsHelp')}</p>
            <p className="muted">{t('paymentHelp')}</p>
            <p className="muted">{t('correctHelp')}</p>
          </>
        )}
      </div>
    </div>
  );
}
