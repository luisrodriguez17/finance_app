import { useState, type ReactNode } from 'react';
import type { AppState, MonthSnapshot } from '../types';
import type { Tab } from '../App';
import { formatMoney, convert, initials, computeReserve } from '../utils';
import type { T } from '../i18n';

type Props = {
  state: AppState;
  month: MonthSnapshot;
  update: (u: (s: AppState) => AppState) => void;
  t: T;
  navigate: (tab: Tab) => void;
};

/** Small "i" button that reveals a bit of explanatory text on tap, keeping the
 *  card visually clean until the user asks for detail. */
function InfoTip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="infotip">
      <button
        type="button"
        className="infotip-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        i
      </button>
      {open && (
        <span className="infotip-bubble" onClick={(e) => e.stopPropagation()}>
          {text}
        </span>
      )}
    </span>
  );
}

/** Chevron affordance shown on tappable cards/sections that navigate elsewhere. */
function GoArrow() {
  return (
    <svg className="go-arrow" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

/** A tappable stat card that navigates to a related view. */
function NavCard({
  onClick,
  title,
  children,
  className = '',
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button type="button" className={`card clickable ${className}`} onClick={onClick}>
      <h3>
        {title}
        <GoArrow />
      </h3>
      {children}
    </button>
  );
}

export default function Dashboard({ state, month, update, t, navigate }: Props) {
  const [showEmergency, setShowEmergency] = useState(false);

  const toggleCC = () =>
    update((s) => ({ ...s, includeCreditCardInBills: !s.includeCreditCardInBills }));

  const toggleImaginary = () =>
    update((s) => ({ ...s, includeImaginaryInDashboard: !s.includeImaginaryInDashboard }));

  const primary = state.primaryCurrency;
  const rate = state.exchangeRate;

  const balanceCRC = state.accounts.filter((a) => a.currency === 'CRC').reduce((s, a) => s + a.balance, 0);
  const balanceUSD = state.accounts.filter((a) => a.currency === 'USD').reduce((s, a) => s + a.balance, 0);
  const balanceCombined =
    convert(balanceCRC, 'CRC', primary, rate) + convert(balanceUSD, 'USD', primary, rate);

  const reservedCRC = state.reserves
    .filter((r) => r.currency === 'CRC')
    .reduce((s, r) => s + computeReserve(r, balanceCRC, balanceUSD), 0);
  const reservedUSD = state.reserves
    .filter((r) => r.currency === 'USD')
    .reduce((s, r) => s + computeReserve(r, balanceCRC, balanceUSD), 0);

  const directBills = month.bills.filter((b) => !b.creditCardId && !b.settledFrom);
  const billsCRC = directBills.filter((b) => b.currency === 'CRC').reduce((s, b) => s + b.amount, 0);
  const billsUSD = directBills.filter((b) => b.currency === 'USD').reduce((s, b) => s + b.amount, 0);

  // CC debt is global (not month-specific), so sum bills-on-card across all months
  // to match the Credit Cards tab.
  const allCardBills = Object.values(state.months).flatMap((m) => m.bills).filter((b) => b.creditCardId);
  const cardBillsCRC = allCardBills.filter((b) => b.currency === 'CRC').reduce((s, b) => s + b.amount, 0);
  const cardBillsUSD = allCardBills.filter((b) => b.currency === 'USD').reduce((s, b) => s + b.amount, 0);

  const ccCRC = state.creditCards.reduce((s, c) => s + c.owedCRC, 0) + cardBillsCRC;
  const ccUSD = state.creditCards.reduce((s, c) => s + c.owedUSD, 0) + cardBillsUSD;

  const totalBillsCRC = billsCRC + (state.includeCreditCardInBills ? ccCRC : 0);
  const totalBillsUSD = billsUSD + (state.includeCreditCardInBills ? ccUSD : 0);
  const totalBillsCombined =
    convert(totalBillsCRC, 'CRC', primary, rate) + convert(totalBillsUSD, 'USD', primary, rate);

  const pendingImaginary = state.imaginary.filter((e) => !e.collected);
  const imaginaryCRC = pendingImaginary.reduce((s, e) => s + e.amountCRC, 0);
  const imaginaryUSD = pendingImaginary.reduce((s, e) => s + e.amountUSD, 0);

  const salaryPrimary = convert(month.salary.amount, month.salary.currency, primary, rate);

  const includeImg = state.includeImaginaryInDashboard;
  const remainingCRC =
    balanceCRC - reservedCRC + (includeImg ? imaginaryCRC : 0) - totalBillsCRC;
  const remainingUSD =
    balanceUSD - reservedUSD + (includeImg ? imaginaryUSD : 0) - totalBillsUSD;
  const remainingCombined =
    convert(remainingCRC, 'CRC', primary, rate) + convert(remainingUSD, 'USD', primary, rate);

  const emergencyCRC = remainingCRC + reservedCRC;
  const emergencyUSD = remainingUSD + reservedUSD;

  const heroCombined = showEmergency
    ? convert(emergencyCRC, 'CRC', primary, rate) + convert(emergencyUSD, 'USD', primary, rate)
    : remainingCombined;
  const heroCRC = showEmergency ? emergencyCRC : remainingCRC;
  const heroUSD = showEmergency ? emergencyUSD : remainingUSD;

  return (
    <div>
      <h2>{t('dashboard')}</h2>

      <div className={`hero ${heroCombined < 0 ? 'debt' : ''}`}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="hero-label">{t('remainingCombined')}</div>
          <div
            onClick={() => setShowEmergency((v) => !v)}
            style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}
          >
            {showEmergency ? t('inclReservesEmergency') : t('reservesLockedAway')}
          </div>
        </div>
        <div className={`hero-value ${heroCombined < 0 ? 'negative' : ''}`}>
          {formatMoney(heroCombined, primary)}
        </div>
        <div className="hero-sub">
          <span>{formatMoney(heroCRC, 'CRC')}</span>
          <span>{formatMoney(heroUSD, 'USD')}</span>
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: '0.72rem' }}>{t('rateNote', { rate })}</div>
      </div>

      <div className="cards dash-grid">
        <NavCard onClick={() => navigate('bills')} title={t('totalBills')}>
          <div className="value">{formatMoney(totalBillsCombined, primary)}</div>
          <div className="sub">
            {formatMoney(totalBillsCRC, 'CRC')} · {formatMoney(totalBillsUSD, 'USD')}
          </div>
        </NavCard>

        <NavCard onClick={() => navigate('accounts')} title={t('totalBalance')}>
          <div className="value">{formatMoney(balanceCombined, primary)}</div>
          <div className="sub">
            {formatMoney(balanceCRC, 'CRC')} · {formatMoney(balanceUSD, 'USD')}
          </div>
        </NavCard>

        <div className="card">
          <h3>{t('remainingUSD')}</h3>
          <div className={`value ${heroUSD < 0 ? 'negative' : 'positive'}`}>{formatMoney(heroUSD, 'USD')}</div>
        </div>

        <div className="card">
          <h3>{t('remainingCRC')}</h3>
          <div className={`value ${heroCRC < 0 ? 'negative' : 'positive'}`}>{formatMoney(heroCRC, 'CRC')}</div>
        </div>

        <button
          type="button"
          className="card clickable salary-card span-2"
          onClick={() => navigate('budget')}
        >
          <div>
            <h3>
              {t('salary')}
              <GoArrow />
            </h3>
            <div className="sub">≈ {formatMoney(salaryPrimary, primary)}</div>
          </div>
          <div className="value">{formatMoney(month.salary.amount, month.salary.currency)}</div>
        </button>
      </div>

      {/* Credit card debt — styled to look like a physical card */}
      <div
        className={`credit-card ${state.includeCreditCardInBills ? 'included' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => navigate('cards')}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('cards')}
      >
        <div className="credit-card-sheen" />
        <div className="credit-card-top">
          <span className="credit-card-chip" />
          <span className="credit-card-brand">{t('creditCardLabel')}</span>
        </div>
        <div className="credit-card-number">•••• •••• •••• ••••</div>
        <div className="credit-card-bottom">
          <div>
            <div className="credit-card-label">{t('totalOwedAcrossCards')}</div>
            <div className="credit-card-amount">
              {formatMoney(ccCRC, 'CRC')} · {formatMoney(ccUSD, 'USD')}
            </div>
          </div>
          <GoArrow />
        </div>
      </div>
      <label className="toggle-row" onClick={(e) => e.stopPropagation()}>
        <span>{t('includeCcInBills')}</span>
        <input
          type="checkbox"
          className="checkbox"
          checked={state.includeCreditCardInBills}
          onChange={toggleCC}
        />
      </label>

      {/* Savings reserves */}
      <div className="section">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 6 }}>
            <h3 className="section-link" onClick={() => navigate('budget')} style={{ margin: 0 }}>
              {t('savingsReserves')}
              <GoArrow />
            </h3>
            <InfoTip text={t('reservesInfo')} label={t('moreInfo')} />
          </div>
          <label className="row" style={{ cursor: 'pointer' }} title={t('showEmergencyView')}>
            <span className="muted" style={{ fontSize: '0.72rem' }}>{t('countAsAvailable')}</span>
            <input
              type="checkbox"
              className="checkbox"
              checked={showEmergency}
              onChange={() => setShowEmergency((v) => !v)}
            />
          </label>
        </div>
        <div className="muted" style={{ marginTop: 2 }}>{t('lockedFromSpending')}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-mono)', marginTop: 6 }}>
          {formatMoney(reservedCRC, 'CRC')} · {formatMoney(reservedUSD, 'USD')}
        </div>
      </div>

      {/* Imaginary money */}
      <div className="section">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 className="section-link" onClick={() => navigate('imaginary')} style={{ margin: 0 }}>
            {t('imaginaryMoney')}
            <GoArrow />
          </h3>
          <input
            type="checkbox"
            className="checkbox"
            checked={state.includeImaginaryInDashboard}
            onChange={toggleImaginary}
          />
        </div>
        <div className="muted" style={{ marginTop: 2 }}>{t('outstandingPeopleOweYou')}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-mono)', marginTop: 6 }}>
          {formatMoney(imaginaryCRC, 'CRC')} · {formatMoney(imaginaryUSD, 'USD')}
        </div>
        <div className="muted" style={{ marginTop: 6 }}>{t('includeImgInProjection')}</div>

        {pendingImaginary.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.05em' }}>
              {t('peopleWhoOweYou')}
            </div>
            {pendingImaginary.map((e) => (
              <div className="list-row" key={e.id}>
                <span className="row">
                  <span className="avatar-badge">{initials(e.personName)}</span>
                  {e.personName}
                </span>
                <span className="amount">
                  {[
                    e.amountCRC ? formatMoney(e.amountCRC, 'CRC') : null,
                    e.amountUSD ? formatMoney(e.amountUSD, 'USD') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || formatMoney(0, 'CRC')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
