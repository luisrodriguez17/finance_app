import { useState } from 'react';
import type { AppState, MonthSnapshot } from '../types';
import { formatMoney, convert, initials } from '../utils';
import { computeReserve } from './Budget';
import type { T } from '../i18n';

type Props = {
  state: AppState;
  month: MonthSnapshot;
  update: (u: (s: AppState) => AppState) => void;
  t: T;
};

export default function Dashboard({ state, month, update, t }: Props) {
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

      <div className="cards">
        <div className="card">
          <h3>{t('salary')}</h3>
          <div className="value">{formatMoney(month.salary.amount, month.salary.currency)}</div>
          <div className="sub">≈ {formatMoney(salaryPrimary, primary)}</div>
        </div>

        <div className="card">
          <h3>{t('totalBalance')}</h3>
          <div className="value">{formatMoney(balanceCombined, primary)}</div>
          <div className="sub">
            {formatMoney(balanceCRC, 'CRC')} · {formatMoney(balanceUSD, 'USD')}
          </div>
        </div>

        <div className="card">
          <h3>{t('totalBills')}</h3>
          <div className="value">{formatMoney(totalBillsCombined, primary)}</div>
          <div className="sub">
            {formatMoney(totalBillsCRC, 'CRC')} · {formatMoney(totalBillsUSD, 'USD')}
          </div>
        </div>

        <div className="card">
          <h3>{t('remainingCRC')}</h3>
          <div className={`value ${heroCRC < 0 ? 'negative' : 'positive'}`}>{formatMoney(heroCRC, 'CRC')}</div>
        </div>

        <div className="card">
          <h3>{t('remainingUSD')}</h3>
          <div className={`value ${heroUSD < 0 ? 'negative' : 'positive'}`}>{formatMoney(heroUSD, 'USD')}</div>
        </div>
      </div>

      <div className="section">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>{t('savingsReserves')}</h3>
          <label className="row" style={{ cursor: 'pointer' }}>
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
        <div className="muted" style={{ marginTop: 6 }}>
          {t('showEmergencyView')}
        </div>
        <p className="muted" style={{ marginTop: 8 }}>{t('reservesInfo')}</p>
      </div>

      <div className="section">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>{t('creditCardDebt')}</h3>
          <input
            type="checkbox"
            className="checkbox"
            checked={state.includeCreditCardInBills}
            onChange={toggleCC}
          />
        </div>
        <div className="muted" style={{ marginTop: 2 }}>{t('totalOwedAcrossCards')}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-mono)', marginTop: 6 }}>
          {formatMoney(ccCRC, 'CRC')} · {formatMoney(ccUSD, 'USD')}
        </div>
        <div className="muted" style={{ marginTop: 6 }}>{t('includeCcInBills')}</div>
      </div>

      <div className="section">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>{t('imaginaryMoney')}</h3>
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
