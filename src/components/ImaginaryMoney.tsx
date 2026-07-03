import { useState } from 'react';
import type { AppState, ImaginaryEntry } from '../types';
import { formatMoney, uid, convert, initials } from '../utils';
import type { T } from '../i18n';
import { AddToggle, EntryItem, Field } from './ui';

type Props = {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
  t: T;
};

type PersonGroup = {
  key: string;
  name: string;
  entries: ImaginaryEntry[];
  pendingCount: number;
  pendingCRC: number;
  pendingUSD: number;
};

const personKey = (name: string) => name.trim().toLowerCase();

function groupByPerson(entries: ImaginaryEntry[]): PersonGroup[] {
  const map = new Map<string, PersonGroup>();
  for (const e of entries) {
    const key = personKey(e.personName);
    let g = map.get(key);
    if (!g) {
      g = { key, name: e.personName.trim(), entries: [], pendingCount: 0, pendingCRC: 0, pendingUSD: 0 };
      map.set(key, g);
    }
    g.entries.push(e);
    if (!e.collected) {
      g.pendingCount++;
      g.pendingCRC += e.amountCRC;
      g.pendingUSD += e.amountUSD;
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      (b.pendingCount > 0 ? 1 : 0) - (a.pendingCount > 0 ? 1 : 0) ||
      a.name.localeCompare(b.name)
  );
}

export default function ImaginaryMoney({ state, update, t }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

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
    setShowAdd(false);
    setExpandedKey(personKey(entry.personName));
  };

  const updateEntry = (id: string, patch: Partial<ImaginaryEntry>) =>
    update((s) => ({
      ...s,
      imaginary: s.imaginary.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));

  const remove = (id: string) =>
    update((s) => ({ ...s, imaginary: s.imaginary.filter((e) => e.id !== id) }));

  const renamePerson = (key: string, newName: string) => {
    update((s) => ({
      ...s,
      imaginary: s.imaginary.map((e) =>
        personKey(e.personName) === key ? { ...e, personName: newName } : e
      ),
    }));
    setExpandedKey(personKey(newName));
  };

  const pending = state.imaginary.filter((e) => !e.collected);
  const owedCRC = pending.reduce((s, e) => s + e.amountCRC, 0);
  const owedUSD = pending.reduce((s, e) => s + e.amountUSD, 0);
  const owedCombined =
    convert(owedCRC, 'CRC', state.primaryCurrency, state.exchangeRate) +
    convert(owedUSD, 'USD', state.primaryCurrency, state.exchangeRate);

  const groups = groupByPerson(state.imaginary);

  return (
    <div>
      <h2>{t('imaginaryTitle')}</h2>
      <p className="muted">{t('imaginaryIntro')}</p>

      <div className="hero">
        <div className="hero-label">{t('combinedTotal', { cur: state.primaryCurrency })}</div>
        <div className="hero-value" style={{ color: 'var(--accent)' }}>
          {formatMoney(owedCombined, state.primaryCurrency)}
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
          {formatMoney(owedCRC, 'CRC')} · {formatMoney(owedUSD, 'USD')} · {t('pendingCount', { n: pending.length })} · {t('peopleCount', { n: groups.length })}
        </div>
      </div>

      <div className="section">
        <h3>{t('peopleWhoOweYou')}</h3>

        <AddToggle open={showAdd} label={t('addEntry')} onClick={() => setShowAdd((v) => !v)} />
        {showAdd && (
          <div className="add-form">
            <div className="field-grid">
              <Field label={t('person')} span2>
                <input placeholder={t('personPlaceholder')} value={personName} onChange={(e) => setPersonName(e.target.value)} />
              </Field>
              <Field label="₡ CRC">
                <input type="number" placeholder={t('owedInCRC')} value={amountCRC} onChange={(e) => setAmountCRC(e.target.value)} />
              </Field>
              <Field label="$ USD">
                <input type="number" placeholder={t('owedInUSD')} value={amountUSD} onChange={(e) => setAmountUSD(e.target.value)} />
              </Field>
              <Field label={t('description')} span2>
                <input placeholder={t('descPlaceholder')} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            </div>
            <div className="entry-actions">
              <button className="primary" onClick={add}>{t('add')}</button>
            </div>
          </div>
        )}

        {groups.length === 0 ? (
          <p className="muted">{t('nothingYet')}</p>
        ) : (
          <div className="entry-list">
            {groups.map((g) => (
              <EntryItem
                key={g.entries[0].id}
                open={expandedKey === g.key}
                onToggle={() => setExpandedKey(expandedKey === g.key ? null : g.key)}
                info={
                  <span className="row" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
                    <span className="avatar-badge">{initials(g.name)}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="entry-title" style={{ display: 'block' }}>{g.name || '—'}</span>
                      <span className="entry-meta">
                        {g.pendingCount > 0
                          ? `${t('pendingCount', { n: g.pendingCount })} · ${t('entriesCount', { n: g.entries.length })}`
                          : t('allCollected')}
                      </span>
                    </span>
                  </span>
                }
                side={
                  g.pendingCount > 0 ? (
                    <>
                      {g.pendingCRC !== 0 && <div className="entry-amount">{formatMoney(g.pendingCRC, 'CRC')}</div>}
                      {g.pendingUSD !== 0 && <div className="entry-amount">{formatMoney(g.pendingUSD, 'USD')}</div>}
                    </>
                  ) : (
                    <div className="entry-amount muted">✓</div>
                  )
                }
              >
                <div className="field-grid">
                  <Field label={t('person')} span2>
                    <input value={g.name} onChange={(e) => renamePerson(g.key, e.target.value)} />
                  </Field>
                </div>

                {g.entries.map((e) => (
                  <div key={e.id} className={`sub-entry ${e.collected ? 'collected' : ''}`}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="muted" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        {e.date}
                      </span>
                      <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
                        <span className="muted" style={{ fontSize: '0.75rem' }}>{t('collected')}</span>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={e.collected}
                          onChange={() => updateEntry(e.id, { collected: !e.collected })}
                        />
                      </label>
                    </div>
                    <div className="field-grid">
                      <Field label={t('description')} span2>
                        <input
                          value={e.description}
                          placeholder={t('descPlaceholder')}
                          onChange={(ev) => updateEntry(e.id, { description: ev.target.value })}
                        />
                      </Field>
                      <Field label="₡ CRC">
                        <input
                          type="number"
                          value={e.amountCRC}
                          onChange={(ev) => updateEntry(e.id, { amountCRC: Number(ev.target.value) })}
                        />
                      </Field>
                      <Field label="$ USD">
                        <input
                          type="number"
                          value={e.amountUSD}
                          onChange={(ev) => updateEntry(e.id, { amountUSD: Number(ev.target.value) })}
                        />
                      </Field>
                    </div>
                    <div className="entry-actions">
                      <button className="danger" onClick={() => remove(e.id)}>{t('remove')}</button>
                    </div>
                  </div>
                ))}
              </EntryItem>
            ))}
          </div>
        )}
        {groups.length > 0 && <p className="muted" style={{ marginTop: 10 }}>{t('tapToEdit')}</p>}
      </div>
    </div>
  );
}
