import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useStore, ensureMonth, currentMonthKey, applyDueSalaries } from './store';
import { monthLabel } from './utils';
import { tFn } from './i18n';
import Dashboard from './components/Dashboard';
import Accounts from './components/Accounts';
import Bills from './components/Bills';
import Budget from './components/Budget';
import CreditCards from './components/CreditCards';
import ImaginaryMoney from './components/ImaginaryMoney';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import Account from './components/Account';
import { useCloudSync } from './lib/cloudSync';
import { drainCapturedBills } from './lib/notificationCapture';
import './App.css';

export type Tab =
  | 'dashboard'
  | 'accounts'
  | 'bills'
  | 'budget'
  | 'cards'
  | 'imaginary'
  | 'analytics'
  | 'account'
  | 'settings';

const primaryTabs: { id: Tab; labelKey: string; icon: (active: boolean) => ReactNode }[] = [
  { id: 'dashboard', labelKey: 'tab_dashboard', icon: HomeIcon },
  { id: 'accounts', labelKey: 'tab_accounts', icon: AccountsIcon },
  { id: 'bills', labelKey: 'tab_bills', icon: BillsIcon },
  { id: 'budget', labelKey: 'tab_budget', icon: BudgetIcon },
];

const moreTabs: { id: Tab; labelKey: string }[] = [
  { id: 'cards', labelKey: 'tab_cards' },
  { id: 'imaginary', labelKey: 'tab_imaginary' },
  { id: 'analytics', labelKey: 'tab_analytics' },
  { id: 'account', labelKey: 'tab_account' },
  { id: 'settings', labelKey: 'tab_settings' },
];

export default function App() {
  const { state, setState, update } = useStore();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey());
  const [moreOpen, setMoreOpen] = useState(false);

  const sync = useCloudSync(state, setState);
  const loaded = state !== null;

  const t = tFn(state?.language ?? 'en');

  useEffect(() => {
    if (state) document.documentElement.dataset.theme = state.theme;
  }, [state?.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loaded) update((s) => ensureMonth(s, selectedMonth));
  }, [selectedMonth, update, loaded]);

  useEffect(() => {
    if (loaded) update((s) => applyDueSalaries(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // Pull bank/wallet notifications captured by the Android listener while we were away.
  useEffect(() => {
    if (!loaded) return;
    const drain = async () => {
      const bills = await drainCapturedBills();
      if (bills.length) {
        update((s) => ({ ...s, pendingBills: [...s.pendingBills, ...bills] }));
      }
    };
    drain();
    const onVisible = () => {
      if (document.visibilityState === 'visible') drain();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loaded, update]);

  const monthKeys = useMemo(
    () =>
      Array.from(
        new Set([currentMonthKey(), ...Object.keys(state?.months ?? {})])
      ).sort().reverse(),
    [state?.months]
  );

  if (!state) {
    return (
      <div className="app">
        <main className="main">
          <p>{t('loading')}</p>
        </main>
      </div>
    );
  }

  const month = state.months[selectedMonth];

  const selectTab = (id: Tab) => {
    setTab(id);
    setMoreOpen(false);
  };

  const isMoreTab = moreTabs.some((mt) => mt.id === tab);

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="logo">💰 {t('appTitle')}</h1>
        <select
          className="month-pill"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {monthKeys.map((k) => (
            <option key={k} value={k}>{monthLabel(k)}</option>
          ))}
        </select>
      </header>

      <main className="main">
        {!month ? (
          <p>{t('loading')}</p>
        ) : tab === 'dashboard' ? (
          <Dashboard state={state} month={month} update={update} t={t} navigate={selectTab} />
        ) : tab === 'accounts' ? (
          <Accounts state={state} update={update} t={t} />
        ) : tab === 'bills' ? (
          <Bills state={state} month={month} update={update} t={t} />
        ) : tab === 'budget' ? (
          <Budget state={state} month={month} update={update} t={t} />
        ) : tab === 'cards' ? (
          <CreditCards state={state} update={update} t={t} />
        ) : tab === 'imaginary' ? (
          <ImaginaryMoney state={state} update={update} t={t} />
        ) : tab === 'analytics' ? (
          <Analytics state={state} t={t} />
        ) : tab === 'account' ? (
          <Account state={state} update={update} t={t} sync={sync} />
        ) : (
          <Settings state={state} update={update} t={t} />
        )}
      </main>

      {moreOpen && (
        <>
          <div className="sheet-backdrop" onClick={() => setMoreOpen(false)} />
          <nav className="more-sheet">
            {moreTabs.map((mt) => (
              <button
                key={mt.id}
                className={`nav-btn ${tab === mt.id ? 'active' : ''}`}
                onClick={() => selectTab(mt.id)}
              >
                {t(mt.labelKey)}
              </button>
            ))}
          </nav>
        </>
      )}

      <nav className="bottom-nav">
        {primaryTabs.map((pt) => {
          const active = tab === pt.id;
          return (
            <button
              key={pt.id}
              type="button"
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => selectTab(pt.id)}
            >
              {pt.icon(active)}
              <span className="nav-label">{t(pt.labelKey)}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={`nav-item ${isMoreTab || moreOpen ? 'active' : ''}`}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <MoreIcon />
          <span className="nav-label">{t('more')}</span>
        </button>
      </nav>
    </div>
  );
}

function HomeIcon(active: boolean) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2}>
      {active ? (
        <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" fill="currentColor" stroke="none" />
      ) : (
        <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function AccountsIcon(active: boolean) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2}>
      <circle cx="12" cy="12" r="8" fill={active ? 'currentColor' : 'none'} />
    </svg>
  );
}

function BillsIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="14" y2="17" />
    </svg>
  );
}

function BudgetIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2}>
      <rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
