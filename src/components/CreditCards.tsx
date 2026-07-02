import { Fragment, useState } from 'react';
import type { AppState, Bill, CreditCard } from '../types';
import { formatMoney, uid, convert } from '../utils';
import { currentMonthKey, ensureMonth } from '../store';
import type { T } from '../i18n';

type Props = {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
  t: T;
};

export default function CreditCards({ state, update, t }: Props) {
  const [name, setName] = useState('');
  const [owedCRC, setOwedCRC] = useState('');
  const [owedUSD, setOwedUSD] = useState('');

  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [realCRC, setRealCRC] = useState('');
  const [realUSD, setRealUSD] = useState('');

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

      <div className="cards">
        <div className="card">
          <h3>{t('crcOwed')}</h3>
          <div className="value negative">{formatMoney(totalCRC, 'CRC')}</div>
        </div>
        <div className="card">
          <h3>{t('usdOwed')}</h3>
          <div className="value negative">{formatMoney(totalUSD, 'USD')}</div>
        </div>
        <div className="card">
          <h3>{t('combinedTotal', { cur: state.primaryCurrency })}</h3>
          <div className="value negative">{formatMoney(combined, state.primaryCurrency)}</div>
        </div>
      </div>

      <div className="section">
        <h3>{t('addCard')}</h3>
        <div className="form-grid">
          <input placeholder={t('cardNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
          <input type="number" placeholder={t('owedInCRC')} value={owedCRC} onChange={(e) => setOwedCRC(e.target.value)} />
          <input type="number" placeholder={t('owedInUSD')} value={owedUSD} onChange={(e) => setOwedUSD(e.target.value)} />
          <button className="primary" onClick={add}>{t('add')}</button>
        </div>
      </div>

      <div className="section">
        <h3>{t('yourCards')}</h3>
        {state.creditCards.length === 0 ? (
          <p className="muted">{t('noCardsYet')}</p>
        ) : (
          <>
          <table>
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('manualCRC')}</th>
                <th>{t('fromBillsCRC')}</th>
                <th>{t('totalCRC')}</th>
                <th>{t('manualUSD')}</th>
                <th>{t('fromBillsUSD')}</th>
                <th>{t('totalUSD')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.creditCards.map((c) => {
                const fromBillsCRC = cardBillsByCard(c.id, 'CRC');
                const fromBillsUSD = cardBillsByCard(c.id, 'USD');
                const totalCardCRC = c.owedCRC + fromBillsCRC;
                const totalCardUSD = c.owedUSD + fromBillsUSD;
                const isCorrecting = correctingId === c.id;
                const previewDeltaCRC = isCorrecting ? Number(realCRC) - totalCardCRC : 0;
                const previewDeltaUSD = isCorrecting ? Number(realUSD) - totalCardUSD : 0;
                return (
                  <Fragment key={c.id}>
                    <tr>
                      <td data-label={t('name')}>
                        <input value={c.name} onChange={(e) => updateCard(c.id, { name: e.target.value })} />
                      </td>
                      <td data-label={t('manualCRC')}>
                        <input
                          type="number"
                          value={c.owedCRC}
                          onChange={(e) => updateCard(c.id, { owedCRC: Number(e.target.value) })}
                          style={{ width: 120 }}
                        />
                      </td>
                      <td data-label={t('fromBillsCRC')} className="muted">{formatMoney(fromBillsCRC, 'CRC')}</td>
                      <td data-label={t('totalCRC')} style={{ fontWeight: 600 }}>{formatMoney(totalCardCRC, 'CRC')}</td>
                      <td data-label={t('manualUSD')}>
                        <input
                          type="number"
                          value={c.owedUSD}
                          onChange={(e) => updateCard(c.id, { owedUSD: Number(e.target.value) })}
                          style={{ width: 120 }}
                        />
                      </td>
                      <td data-label={t('fromBillsUSD')} className="muted">{formatMoney(fromBillsUSD, 'USD')}</td>
                      <td data-label={t('totalUSD')} style={{ fontWeight: 600 }}>{formatMoney(totalCardUSD, 'USD')}</td>
                      <td>
                        <div className="row">
                          <button className="ghost" onClick={() => (isCorrecting ? cancelCorrection() : startCorrection(c))}>
                            {isCorrecting ? t('cancel') : t('correct')}
                          </button>
                          <button className="danger" onClick={() => remove(c.id)}>{t('remove')}</button>
                        </div>
                      </td>
                    </tr>
                    {isCorrecting && (
                      <tr>
                        <td colSpan={8} style={{ background: '#1f2330' }}>
                          <div className="row" style={{ padding: 8, flexWrap: 'wrap' }}>
                            <span className="muted">{t('correctionPrompt')}</span>
                            <label className="row">
                              <span>{t('realCRC')}</span>
                              <input
                                type="number"
                                value={realCRC}
                                onChange={(e) => setRealCRC(e.target.value)}
                                style={{ width: 140 }}
                              />
                              <span className={previewDeltaCRC === 0 ? 'muted' : previewDeltaCRC > 0 ? 'value negative' : 'value positive'}>
                                Δ {formatMoney(previewDeltaCRC, 'CRC')}
                              </span>
                            </label>
                            <label className="row">
                              <span>{t('realUSD')}</span>
                              <input
                                type="number"
                                value={realUSD}
                                onChange={(e) => setRealUSD(e.target.value)}
                                style={{ width: 140 }}
                              />
                              <span className={previewDeltaUSD === 0 ? 'muted' : previewDeltaUSD > 0 ? 'value negative' : 'value positive'}>
                                Δ {formatMoney(previewDeltaUSD, 'USD')}
                              </span>
                            </label>
                            <button className="primary" onClick={() => applyCorrection(c)}>
                              {t('createOffset')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <p className="muted">{t('cardsHelp')}</p>
          <p className="muted">{t('correctHelp')}</p>
          </>
        )}
      </div>
    </div>
  );
}
