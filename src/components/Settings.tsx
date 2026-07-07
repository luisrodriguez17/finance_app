import { useState } from 'react';
import type { AppState, Currency, Language, SalarySchedule, Theme } from '../types';
import {
  markPastAsApplied,
  applyDueSalaries,
  previewNegativeOffsetCleanup,
  cleanupNegativeOffsetBills,
} from '../store';
import { formatMoney } from '../utils';
import type { T } from '../i18n';

type Props = {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
  t: T;
};

export default function Settings({ state, update, t }: Props) {
  const [newCat, setNewCat] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const addCategory = () => {
    if (!newCat || state.categories.includes(newCat)) return;
    update((s) => ({ ...s, categories: [...s.categories, newCat] }));
    setNewCat('');
  };

  const removeCategory = (c: string) =>
    update((s) => ({ ...s, categories: s.categories.filter((x) => x !== c) }));

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        update(() => parsed as AppState);
      } catch {
        alert(t('invalidFile'));
      }
    };
    reader.readAsText(file);
  };

  const importPasted = () => {
    try {
      const parsed = JSON.parse(pasteText);
      if (!parsed || typeof parsed !== 'object' || !('months' in parsed)) {
        alert(t('invalidFile'));
        return;
      }
      update(() => parsed as AppState);
      setPasteText('');
      setPasteOpen(false);
    } catch {
      alert(t('invalidFile'));
    }
  };

  return (
    <div>
      <h2>{t('settings')}</h2>

      <div className="section">
        <h3>{t('appearance')}</h3>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">{t('theme')}</span>
          <label className="row" style={{ cursor: 'pointer' }}>
            <span className="muted">{state.theme === 'dark' ? t('themeDark') : t('themeLight')}</span>
            <input
              type="checkbox"
              className="checkbox"
              checked={state.theme === 'light'}
              onChange={(e) =>
                update((s) => ({ ...s, theme: (e.target.checked ? 'light' : 'dark') as Theme }))
              }
            />
          </label>
        </div>
      </div>

      <div className="section">
        <h3>{t('language')}</h3>
        <div className="form-grid">
          <div>
            <select
              value={state.language}
              onChange={(e) => update((s) => ({ ...s, language: e.target.value as Language }))}
            >
              <option value="en">{t('english')}</option>
              <option value="es">{t('spanish')}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="section">
        <h3>{t('currencySection')}</h3>
        <div className="form-grid">
          <div>
            <label className="muted">{t('primaryCurrency')}</label>
            <select
              value={state.primaryCurrency}
              onChange={(e) =>
                update((s) => ({ ...s, primaryCurrency: e.target.value as Currency }))
              }
            >
              <option value="CRC">{t('colones')}</option>
              <option value="USD">{t('dollars')}</option>
            </select>
          </div>
          <div>
            <label className="muted">{t('exchangeRate')}</label>
            <input
              type="number"
              value={state.exchangeRate}
              onChange={(e) => update((s) => ({ ...s, exchangeRate: Number(e.target.value) }))}
            />
          </div>
        </div>
      </div>

      <div className="section">
        <h3>{t('categories')}</h3>
        <div className="row">
          <input
            placeholder={t('newCategory')}
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
          />
          <button className="primary" onClick={addCategory}>{t('add')}</button>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          {state.categories.map((c) => (
            <span key={c} className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {c}
              <button
                className="ghost"
                style={{ padding: '0 6px', fontSize: '0.7rem' }}
                onClick={() => removeCategory(c)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <SalaryScheduleSection state={state} update={update} t={t} />

      <NegativeOffsetCleanupSection state={state} update={update} t={t} />

      <div className="section">
        <h3>{t('backup')}</h3>
        <div className="row">
          <button className="primary" onClick={exportData}>{t('exportJSON')}</button>
          <label className="ghost" style={{ cursor: 'pointer', padding: '6px 10px', borderRadius: 6, border: '1px solid #2a2f3d' }}>
            {t('importJSON')}
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files && importData(e.target.files[0])}
            />
          </label>
          <button className="ghost" onClick={() => setPasteOpen((v) => !v)}>
            {pasteOpen ? t('cancel') : t('pasteJSON')}
          </button>
        </div>
        {pasteOpen && (
          <div style={{ marginTop: 12 }}>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={t('pasteJSONPlaceholder')}
              rows={6}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }}
            />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="primary" onClick={importPasted} disabled={!pasteText.trim()}>
                {t('importJSON')}
              </button>
            </div>
            <p className="muted" style={{ marginTop: 8 }}>{t('pasteJSONHint')}</p>
          </div>
        )}
        <p className="muted" style={{ marginTop: 8 }}>{t('backupNote')}</p>
      </div>
    </div>
  );
}

function SalaryScheduleSection({ state, update, t }: Props) {
  const s = state.salarySchedule;

  const patch = (p: Partial<SalarySchedule>) =>
    update((st) => ({ ...st, salarySchedule: { ...st.salarySchedule, ...p } }));

  const toggleEnabled = (next: boolean) => {
    if (next && !s.enabled) {
      update((st) => ({
        ...st,
        salarySchedule: { ...markPastAsApplied(st.salarySchedule), enabled: true },
      }));
    } else {
      patch({ enabled: next });
    }
  };

  const runNow = () => update((st) => applyDueSalaries(st));

  const resetHistory = () => {
    if (!window.confirm(t('confirmResetHistory'))) return;
    patch({ appliedDates: [] });
  };

  return (
    <div className="section">
      <h3>{t('salarySchedule')}</h3>
      <p className="muted">{t('salaryScheduleIntro')}</p>

      <div className="form-grid">
        <label className="row" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            className="checkbox"
            checked={s.enabled}
            onChange={(e) => toggleEnabled(e.target.checked)}
          />
          <span>{t('enabled')}</span>
        </label>

        <div>
          <label className="muted">{t('cadence')}</label>
          <select
            value={s.cadence}
            onChange={(e) => patch({ cadence: e.target.value as 'monthly' | 'biweekly' })}
          >
            <option value="monthly">{t('cadenceMonthly')}</option>
            <option value="biweekly">{t('cadenceBiweekly')}</option>
          </select>
        </div>

        <div>
          <label className="muted">{s.cadence === 'biweekly' ? t('firstPayDay') : t('payDay')}</label>
          <input
            type="number"
            min={1}
            max={31}
            value={s.day1}
            onChange={(e) => patch({ day1: Number(e.target.value) || 1 })}
          />
        </div>

        {s.cadence === 'biweekly' && (
          <div>
            <label className="muted">{t('secondPayDay')}</label>
            <input
              type="number"
              min={1}
              max={31}
              value={s.day2 ?? 30}
              onChange={(e) => patch({ day2: Number(e.target.value) || 30 })}
            />
          </div>
        )}

        <div>
          <label className="muted">{t('amountPerPay')}</label>
          <input
            type="number"
            value={s.amount}
            onChange={(e) => patch({ amount: Number(e.target.value) })}
          />
        </div>

        <div>
          <label className="muted">{t('currency')}</label>
          <select value={s.currency} onChange={(e) => patch({ currency: e.target.value as Currency })}>
            <option value="CRC">₡ CRC</option>
            <option value="USD">$ USD</option>
          </select>
        </div>

        <div>
          <label className="muted">{t('depositToAccount')}</label>
          <select
            value={s.accountId || ''}
            onChange={(e) => patch({ accountId: e.target.value || undefined })}
          >
            <option value="">{t('none')}</option>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </select>
        </div>

        <label className="row" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            className="checkbox"
            checked={s.fundsNextMonth ?? false}
            onChange={(e) => patch({ fundsNextMonth: e.target.checked })}
          />
          <span>{t('fundsNextMonth')}</span>
        </label>
      </div>
      <p className="muted" style={{ marginTop: 4 }}>{t('fundsNextMonthHelp')}</p>

      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" onClick={runNow} disabled={!s.enabled}>
          {t('runNow')}
        </button>
        <button className="ghost" onClick={resetHistory}>
          {t('resetAppliedHistory')}
        </button>
        <span className="muted">
          {t('pastDepositsRecorded', { n: s.appliedDates.length })}
        </span>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>{t('salaryScheduleHelp')}</p>
    </div>
  );
}

function NegativeOffsetCleanupSection({ state, update, t }: Props) {
  const preview = previewNegativeOffsetCleanup(state);
  if (preview.count === 0) return null;

  const apply = () => {
    if (!window.confirm(t('cleanupConfirm', { n: preview.count }))) return;
    update((s) => cleanupNegativeOffsetBills(s));
  };

  return (
    <div className="section">
      <h3>{t('cleanupTitle')}</h3>
      <p className="muted">{t('cleanupFound', { n: preview.count, cards: preview.cardCount })}</p>
      <p className="muted" style={{ fontFamily: 'var(--font-mono)' }}>
        {preview.totalCRC !== 0 && formatMoney(preview.totalCRC, 'CRC')}
        {preview.totalCRC !== 0 && preview.totalUSD !== 0 && ' · '}
        {preview.totalUSD !== 0 && formatMoney(preview.totalUSD, 'USD')}
      </p>
      <button className="primary" onClick={apply}>{t('cleanupButton')}</button>
    </div>
  );
}
