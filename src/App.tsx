import { useEffect, useMemo, useState } from 'react';
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
import './App.css';

type Tab =
  | 'dashboard'
  | 'accounts'
  | 'bills'
  | 'budget'
  | 'cards'
  | 'imaginary'
  | 'analytics'
  | 'settings';

export default function App() {
  const { state, update } = useStore();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey());
  const [menuOpen, setMenuOpen] = useState(false);

  const t = tFn(state.language);

  useEffect(() => {
    update((s) => ensureMonth(s, selectedMonth));
  }, [selectedMonth, update]);

  useEffect(() => {
    update((s) => applyDueSalaries(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthKeys = useMemo(
    () =>
      Array.from(new Set([currentMonthKey(), ...Object.keys(state.months)])).sort().reverse(),
    [state.months]
  );

  const month = state.months[selectedMonth];

  const tabs: { id: Tab; labelKey: string }[] = [
    { id: 'dashboard', labelKey: 'tab_dashboard' },
    { id: 'accounts', labelKey: 'tab_accounts' },
    { id: 'bills', labelKey: 'tab_bills' },
    { id: 'budget', labelKey: 'tab_budget' },
    { id: 'cards', labelKey: 'tab_cards' },
    { id: 'imaginary', labelKey: 'tab_imaginary' },
    { id: 'analytics', labelKey: 'tab_analytics' },
    { id: 'settings', labelKey: 'tab_settings' },
  ];

  const selectTab = (id: Tab) => {
    setTab(id);
    setMenuOpen(false);
  };

  return (
    <div className="app">
      {/* Mobile top bar (visible only on small screens via CSS) */}
      <header className="mobile-topbar">
        <button
          type="button"
          className="hamburger"
          aria-label={t('menu')}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span /><span /><span />
        </button>
        <h1 className="logo">💰 {t('appTitle')}</h1>
        <select
          className="topbar-month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {monthKeys.map((k) => (
            <option key={k} value={k}>{monthLabel(k)}</option>
          ))}
        </select>
      </header>

      {/* Mobile slide-down drawer */}
      {menuOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setMenuOpen(false)} />
          <nav className="mobile-drawer">
            {tabs.map((tt) => (
              <button
                key={tt.id}
                className={`nav-btn ${tab === tt.id ? 'active' : ''}`}
                onClick={() => selectTab(tt.id)}
              >
                {t(tt.labelKey)}
              </button>
            ))}
          </nav>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className="sidebar">
        <h1 className="logo">💰 {t('appTitle')}</h1>
        <nav>
          {tabs.map((tt) => (
            <button
              key={tt.id}
              className={`nav-btn ${tab === tt.id ? 'active' : ''}`}
              onClick={() => setTab(tt.id)}
            >
              {t(tt.labelKey)}
            </button>
          ))}
        </nav>
        <div className="month-picker">
          <label>{t('month')}</label>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            {monthKeys.map((k) => (
              <option key={k} value={k}>{monthLabel(k)}</option>
            ))}
          </select>
        </div>
      </aside>

      <main className="main">
        {!month ? (
          <p>{t('loading')}</p>
        ) : tab === 'dashboard' ? (
          <Dashboard state={state} month={month} update={update} t={t} />
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
        ) : (
          <Settings state={state} update={update} t={t} />
        )}
      </main>
    </div>
  );
}
