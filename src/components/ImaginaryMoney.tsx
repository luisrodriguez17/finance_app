import { useState } from 'react';
import type { AppState, ImaginaryEntry } from '../types';
import { formatMoney, uid, convert } from '../utils';
import type { T } from '../i18n';

type Props = {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
  t: T;
};

export default function ImaginaryMoney({ state, update, t }: Props) {
  const [personName, setPersonName] = useState('');
  const [amountCRC, setAmountCRC] = useState('');
  const [amountUSD, setAmountUSD] = useState('');
  const [description, setDescription] = useState('');

  const add = () => {
    if (!personName) return;
    const entry: ImaginaryEntry = {
      id: uid(),
      personName,
      amountCRC: Number(amountCRC) || 0,
      amountUSD: Number(amountUSD) || 0,
      description,
      date: new Date().toISOString().slice(0, 10),
      collected: false,
    };
    update((s) => ({ ...s, imaginary: [...s.imaginary, entry] }));
    setPersonName('');
    setAmountCRC('');
    setAmountUSD('');
    setDescription('');
  };

  const updateEntry = (id: string, patch: Partial<ImaginaryEntry>) =>
    update((s) => ({
      ...s,
      imaginary: s.imaginary.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));

  const remove = (id: string) =>
    update((s) => ({ ...s, imaginary: s.imaginary.filter((e) => e.id !== id) }));

  const pending = state.imaginary.filter((e) => !e.collected);
  const owedCRC = pending.reduce((s, e) => s + e.amountCRC, 0);
  const owedUSD = pending.reduce((s, e) => s + e.amountUSD, 0);
  const owedCombined =
    convert(owedCRC, 'CRC', state.primaryCurrency, state.exchangeRate) +
    convert(owedUSD, 'USD', state.primaryCurrency, state.exchangeRate);

  return (
    <div>
      <h2>{t('imaginaryTitle')}</h2>
      <p className="muted">{t('imaginaryIntro')}</p>

      <div className="cards">
        <div className="card">
          <h3>{t('crcOutstanding')}</h3>
          <div className="value positive">{formatMoney(owedCRC, 'CRC')}</div>
        </div>
        <div className="card">
          <h3>{t('usdOutstanding')}</h3>
          <div className="value positive">{formatMoney(owedUSD, 'USD')}</div>
        </div>
        <div className="card">
          <h3>{t('combinedTotal', { cur: state.primaryCurrency })}</h3>
          <div className="value positive">{formatMoney(owedCombined, state.primaryCurrency)}</div>
          <div className="sub">{t('pendingCount', { n: pending.length })}</div>
        </div>
      </div>

      <div className="section">
        <h3>{t('addEntry')}</h3>
        <div className="form-grid">
          <input placeholder={t('personPlaceholder')} value={personName} onChange={(e) => setPersonName(e.target.value)} />
          <input type="number" placeholder={t('owedInCRC')} value={amountCRC} onChange={(e) => setAmountCRC(e.target.value)} />
          <input type="number" placeholder={t('owedInUSD')} value={amountUSD} onChange={(e) => setAmountUSD(e.target.value)} />
          <input placeholder={t('descPlaceholder')} value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="primary" onClick={add}>{t('add')}</button>
        </div>
      </div>

      <div className="section">
        <h3>{t('entries')}</h3>
        {state.imaginary.length === 0 ? (
          <p className="muted">{t('nothingYet')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('person')}</th>
                <th>₡ CRC</th>
                <th>$ USD</th>
                <th>{t('description')}</th>
                <th>{t('date')}</th>
                <th>{t('collected')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.imaginary.map((e) => (
                <tr key={e.id} style={{ opacity: e.collected ? 0.5 : 1 }}>
                  <td data-label={t('person')}>
                    <input
                      value={e.personName}
                      onChange={(ev) => updateEntry(e.id, { personName: ev.target.value })}
                    />
                  </td>
                  <td data-label="₡ CRC">
                    <input
                      type="number"
                      value={e.amountCRC}
                      onChange={(ev) => updateEntry(e.id, { amountCRC: Number(ev.target.value) })}
                      style={{ width: 130 }}
                    />
                  </td>
                  <td data-label="$ USD">
                    <input
                      type="number"
                      value={e.amountUSD}
                      onChange={(ev) => updateEntry(e.id, { amountUSD: Number(ev.target.value) })}
                      style={{ width: 130 }}
                    />
                  </td>
                  <td data-label={t('description')}>
                    <input
                      value={e.description}
                      onChange={(ev) => updateEntry(e.id, { description: ev.target.value })}
                    />
                  </td>
                  <td data-label={t('date')}>{e.date}</td>
                  <td data-label={t('collected')}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={e.collected}
                      onChange={() => updateEntry(e.id, { collected: !e.collected })}
                    />
                  </td>
                  <td>
                    <button className="danger" onClick={() => remove(e.id)}>{t('remove')}</button>
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
