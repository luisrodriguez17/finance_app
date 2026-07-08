import { useEffect, useState } from 'react';
import type { AppState, Bill, PendingBill } from '../types';
import { ensureMonth, currentMonthKey } from '../store';
import type { T } from '../i18n';
import type { CloudSync } from '../lib/cloudSync';
import {
  isNativeAndroid,
  isNotificationAccessEnabled,
  openNotificationAccessSettings,
} from '../lib/notificationCapture';

type Props = {
  state: AppState;
  update: (u: (s: AppState) => AppState) => void;
  t: T;
  sync: CloudSync;
};

const INBOUND_DOMAIN = (import.meta.env.VITE_INBOUND_EMAIL_DOMAIN as string) || 'your-domain.com';

export default function Account({ state, update, t, sync }: Props) {
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [notifAccess, setNotifAccess] = useState(false);

  useEffect(() => {
    isNotificationAccessEnabled().then(setNotifAccess);
  }, []);

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    setSyncError('');
    try {
      await fn();
      setPassphrase('');
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const acceptPending = (p: PendingBill) => {
    update((s0) => {
      const key = currentMonthKey();
      let s = ensureMonth(s0, key);
      const accountId = s.autoBills.defaultAccountId;
      const acc = accountId ? s.accounts.find((a) => a.id === accountId) : undefined;
      const settle = Boolean(acc && acc.currency === p.currency);
      const bill: Bill = {
        id: p.id,
        name: p.merchant,
        amount: p.amount,
        currency: p.currency,
        category: s.autoBills.defaultCategory || 'Other',
        source: 'manual',
        accountId: settle ? accountId : undefined,
        paid: settle,
        settledFrom: settle
          ? { accountId: accountId!, amount: p.amount, currency: p.currency }
          : undefined,
      };
      if (settle) {
        s = {
          ...s,
          accounts: s.accounts.map((a) =>
            a.id === accountId ? { ...a, balance: a.balance - p.amount } : a
          ),
        };
      }
      const month = s.months[key];
      return {
        ...s,
        months: { ...s.months, [key]: { ...month, bills: [...month.bills, bill] } },
        pendingBills: s.pendingBills.filter((x) => x.id !== p.id),
      };
    });
  };

  const dismissPending = (id: string) =>
    update((s) => ({ ...s, pendingBills: s.pendingBills.filter((x) => x.id !== id) }));

  const fmtDate = (iso: string) => new Date(iso).toLocaleString();

  return (
    <div>
      <h2>{t('tab_account')}</h2>

      {/* ---- Sign in / profile ---- */}
      <div className="section">
        <h3>{t('accountSignIn')}</h3>
        {sync.status === 'unconfigured' ? (
          <p className="muted">{t('cloudNotConfigured')}</p>
        ) : sync.user ? (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div>{sync.user.displayName || sync.user.email}</div>
                <div className="muted">{sync.user.email}</div>
              </div>
              <button onClick={() => sync.signOutUser()}>{t('signOut')}</button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">{t('signInBenefit')}</p>
            <div className="row">
              <button onClick={() => withBusy(sync.signInGoogle)} disabled={busy}>
                {t('signInGoogle')}
              </button>
              <button onClick={() => withBusy(sync.signInMicrosoft)} disabled={busy}>
                {t('signInMicrosoft')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ---- Cloud sync ---- */}
      {sync.user && (
        <div className="section">
          <h3>{t('cloudSync')}</h3>
          {sync.status === 'active' ? (
            <p className="muted">
              {t('syncActive')}
              {sync.lastSyncedAt ? ` · ${fmtDate(new Date(sync.lastSyncedAt).toISOString())}` : ''}
            </p>
          ) : sync.status === 'needs-setup' ? (
            <>
              <p className="muted">{t('syncSetupHint')}</p>
              <div className="row">
                <input
                  type="password"
                  placeholder={t('syncPassphrase')}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
                <button
                  disabled={busy || passphrase.length < 8}
                  onClick={() => withBusy(() => sync.enableSync(passphrase))}
                >
                  {t('enableSync')}
                </button>
              </div>
              {passphrase.length > 0 && passphrase.length < 8 && (
                <p className="muted">{t('passphraseTooShort')}</p>
              )}
            </>
          ) : sync.status === 'needs-passphrase' ? (
            <>
              <p className="muted">{t('syncUnlockHint')}</p>
              <div className="row">
                <input
                  type="password"
                  placeholder={t('syncPassphrase')}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
                <button
                  disabled={busy || !passphrase}
                  onClick={() => withBusy(() => sync.unlockWithPassphrase(passphrase))}
                >
                  {t('unlockSync')}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">{t('syncChecking')}</p>
          )}
          {(syncError || sync.error) && <p style={{ color: 'tomato' }}>{syncError || sync.error}</p>}
        </div>
      )}

      {/* ---- Security ---- */}
      <div className="section">
        <h3>{t('security')}</h3>
        <p className="muted">{t('encryptionInfo')}</p>
      </div>

      {/* ---- Automatic bills ---- */}
      <div className="section">
        <h3>{t('autoBills')}</h3>

        {isNativeAndroid() ? (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">{t('notificationCapture')}</span>
            {notifAccess ? (
              <span>{t('accessEnabled')}</span>
            ) : (
              <button onClick={() => openNotificationAccessSettings()}>
                {t('grantNotificationAccess')}
              </button>
            )}
          </div>
        ) : (
          <p className="muted">{t('notificationCaptureAndroidOnly')}</p>
        )}

        <div style={{ marginTop: 12 }}>
          <span className="muted">{t('emailForwarding')}</span>
          {state.autoBills.emailToken ? (
            <p>
              <code>bills+{state.autoBills.emailToken}@{INBOUND_DOMAIN}</code>
              <br />
              <span className="muted">{t('emailForwardingHint')}</span>
            </p>
          ) : sync.user ? (
            <div className="row">
              <button disabled={busy} onClick={() => withBusy(async () => { await sync.createEmailToken(); })}>
                {t('generateEmailAddress')}
              </button>
            </div>
          ) : (
            <p className="muted">{t('emailForwardingNeedsSignIn')}</p>
          )}
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <label className="muted">{t('autoBillDefaultCategory')}</label>
          <select
            value={state.autoBills.defaultCategory || ''}
            onChange={(e) =>
              update((s) => ({
                ...s,
                autoBills: { ...s.autoBills, defaultCategory: e.target.value || undefined },
              }))
            }
          >
            <option value="">{t('category')}</option>
            {state.categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label className="muted">{t('account')}</label>
          <select
            value={state.autoBills.defaultAccountId || ''}
            onChange={(e) =>
              update((s) => ({
                ...s,
                autoBills: { ...s.autoBills, defaultAccountId: e.target.value || undefined },
              }))
            }
          >
            <option value="">{t('noAccount')}</option>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ---- Pending captured bills ---- */}
      {state.pendingBills.length > 0 && (
        <div className="section">
          <h3>
            {t('pendingBills')} ({state.pendingBills.length})
          </h3>
          {state.pendingBills.map((p) => (
            <div key={p.id} className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div>
                  {p.merchant} — {p.currency === 'CRC' ? '₡' : '$'}
                  {p.amount.toLocaleString()}
                </div>
                <div className="muted">
                  {p.source === 'notification' ? t('fromNotification') : t('fromEmail')} ·{' '}
                  {fmtDate(p.capturedAt)}
                </div>
              </div>
              <div className="row">
                <button onClick={() => acceptPending(p)}>{t('add')}</button>
                <button onClick={() => dismissPending(p.id)}>{t('dismiss')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
