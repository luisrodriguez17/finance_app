import { useState } from 'react';
import type { AppState, MonthSnapshot } from '../types';
import { formatMoney, convert } from '../utils';
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

  return (
    <div>
      <h2>{t('dashboard')}</h2>

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
          <div className={`value ${(showEmergency ? emergencyCRC : remainingCRC) < 0 ? 'negative' : 'positive'}`}>
            {formatMoney(showEmergency ? emergencyCRC : remainingCRC, 'CRC')}
          </div>
          <div className="sub">
            {showEmergency ? t('inclReservesEmergency') : t('reservesLockedAway')}
          </div>
        </div>

        <div className="card">
          <h3>{t('remainingUSD')}</h3>
          <div className={`value ${(showEmergency ? emergencyUSD : remainingUSD) < 0 ? 'negative' : 'positive'}`}>
            {formatMoney(showEmergency ? emergencyUSD : remainingUSD, 'USD')}
          </div>
          <div className="sub">
            {showEmergency ? t('inclReservesEmergency') : t('reservesLockedAway')}
          </div>
        </div>

        <div className="card">
          <h3>{t('remainingCombined')}</h3>
          <div className={`value ${remainingCombined < 0 ? 'negative' : 'positive'}`}>
            {formatMoney(
              showEmergency
                ? convert(emergencyCRC, 'CRC', primary, rate) + convert(emergencyUSD, 'USD', primary, rate)
                : remainingCombined,
              primary
            )}
          </div>
          <div className="sub">{t('rateNote', { rate })}</div>
        </div>
      </div>

      <div className="section">
        <h3>{t('savingsReserves')}</h3>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="muted">{t('lockedFromSpending')}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
              {formatMoney(reservedCRC, 'CRC')} · {formatMoney(reservedUSD, 'USD')}
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              {t('reservesInfo')}
            </div>
          </div>
          <label className="row" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              className="checkbox"
              checked={showEmergency}
              onChange={() => setShowEmergency((v) => !v)}
            />
            <span>{t('showEmergencyView')}</span>
          </label>
        </div>
      </div>

      <div className="section">
        <h3>{t('creditCardDebt')}</h3>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="muted">{t('totalOwedAcrossCards')}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
              {formatMoney(ccCRC, 'CRC')} · {formatMoney(ccUSD, 'USD')}
            </div>
          </div>
          <label className="row" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              className="checkbox"
              checked={state.includeCreditCardInBills}
              onChange={toggleCC}
            />
            <span>{t('includeCcInBills')}</span>
          </label>
        </div>
      </div>

      <div className="section">
        <h3>{t('imaginaryMoney')}</h3>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="muted">{t('outstandingPeopleOweYou')}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
              {formatMoney(imaginaryCRC, 'CRC')} · {formatMoney(imaginaryUSD, 'USD')}
            </div>
          </div>
          <label className="row" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              className="checkbox"
              checked={state.includeImaginaryInDashboard}
              onChange={toggleImaginary}
            />
            <span>{t('includeImgInProjection')}</span>
          </label>
        </div>
      </div>
    </div>
  );
}
