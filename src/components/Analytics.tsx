import { useMemo, useState } from 'react';
import type { AppState, Bill } from '../types';
import { convert, formatMoney, monthLabel } from '../utils';
import { categoryLabel, type T } from '../i18n';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

const COLORS = ['#4f7cff', '#4ade80', '#f59e0b', '#f87171', '#a78bfa', '#22d3ee', '#fb7185', '#facc15'];

const RADIAN = Math.PI / 180;
// Recharts' default pie `label` places text at a fixed offset outside the slice with a
// connector line; with many categories on a narrow screen those labels collide and overlap.
// Rendering the percentage inside the slice instead (and skipping slivers) keeps it legible on mobile.
function renderPieLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent = 0,
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}) {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#0b0d12" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

type BillWithMonth = Bill & { monthKey: string };

export default function Analytics({ state, t }: { state: AppState; t: T }) {
  const primary = state.primaryCurrency;
  const rate = state.exchangeRate;

  const isDark = state.theme !== 'light';
  const chartAccent = isDark ? 'oklch(0.62 0.14 152)' : 'oklch(0.45 0.13 152)';
  const chartWarn = isDark ? 'oklch(0.68 0.15 40)' : 'oklch(0.55 0.16 40)';
  const chartMuted = isDark ? 'oklch(0.7 0.02 150)' : 'oklch(0.45 0.01 80)';
  const chartGrid = isDark ? 'oklch(1 0 0 / 8%)' : 'oklch(0.2 0.01 80 / 10%)';
  const chartSurface = isDark ? 'oklch(0.21 0.015 150)' : 'oklch(0.995 0.005 80)';
  const chartBorder = isDark ? 'oklch(1 0 0 / 10%)' : 'oklch(0.2 0.01 80 / 12%)';
  const tooltipStyle = {
    background: chartSurface,
    border: `1px solid ${chartBorder}`,
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
  };

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<Set<string> | null>(null);

  const monthly = useMemo(() => {
    const keys = Object.keys(state.months).sort();
    // Savings accumulate: each month's leftover carries into the running total shown on
    // the "net savings over time" chart, rather than resetting to just that month's net.
    return keys.reduce<Array<{
      key: string;
      label: string;
      salary: number;
      bills: number;
      net: number;
      cumulativeNet: number;
    }>>((acc, k) => {
      const m = state.months[k];
      const bills = m.bills.reduce((s, b) => s + convert(b.amount, b.currency, primary, rate), 0);
      const salary = convert(m.salary.amount, m.salary.currency, primary, rate);
      const net = salary - bills;
      const prevCumulative = acc.length ? acc[acc.length - 1].cumulativeNet : 0;
      acc.push({
        key: k,
        label: monthLabel(k),
        salary: Math.round(salary),
        bills: Math.round(bills),
        net: Math.round(net),
        cumulativeNet: Math.round(prevCumulative + net),
      });
      return acc;
    }, []);
  }, [state, primary, rate]);

  const filteredMonthly = useMemo(
    () => (selectedMonths ? monthly.filter((m) => selectedMonths.has(m.key)) : monthly),
    [monthly, selectedMonths]
  );

  const toggleMonth = (key: string) =>
    setSelectedMonths((prev) => {
      const base = prev ?? new Set(monthly.map((m) => m.key));
      const next = new Set(base);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const monthInFilter = (k: string) => !selectedMonths || selectedMonths.has(k);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.entries(state.months).forEach(([k, m]) => {
      if (!monthInFilter(k)) return;
      m.bills.forEach((b) => {
        totals[b.category] = (totals[b.category] || 0) + convert(b.amount, b.currency, primary, rate);
      });
    });
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, primary, rate, selectedMonths]);

  const totalSpent = categoryTotals.reduce((s, c) => s + c.value, 0);

  const billsForCategory: BillWithMonth[] = useMemo(() => {
    if (!selectedCategory) return [];
    const rows: BillWithMonth[] = [];
    Object.keys(state.months)
      .sort()
      .reverse()
      .forEach((k) => {
        if (!monthInFilter(k)) return;
        state.months[k].bills
          .filter((b) => b.category === selectedCategory)
          .forEach((b) => rows.push({ ...b, monthKey: k }));
      });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.months, selectedCategory, selectedMonths]);

  const selectedTotal = billsForCategory.reduce(
    (s, b) => s + convert(b.amount, b.currency, primary, rate),
    0
  );

  const accountName = (id?: string) =>
    id ? state.accounts.find((a) => a.id === id)?.name || '(removed)' : '';
  const cardName = (id?: string) =>
    id ? state.creditCards.find((c) => c.id === id)?.name || '(removed)' : '';

  return (
    <div>
      <h2>{t('analyticsTitle')}</h2>
      <p className="muted">{t('analyticsIntro', { cur: primary })}</p>

      <div className="hero">
        <div className="hero-label">{t('totalSpent')}</div>
        <div className="hero-value">{formatMoney(totalSpent, primary)}</div>
        <div className="muted" style={{ marginTop: 8, fontSize: '0.72rem' }}>
          {selectedMonths ? t('inSelectedMonths') : t('allTime')}
        </div>
      </div>

      <div className="cards">
        <div className="card">
          <h3>{t('monthsShown')}</h3>
          <div className="value">{filteredMonthly.length}</div>
          <div className="sub">{t('ofXTracked', { n: monthly.length })}</div>
        </div>
        <div className="card">
          <h3>{t('avgMonthlyBills')}</h3>
          <div className="value">
            {formatMoney(filteredMonthly.length ? Math.round(totalSpent / filteredMonthly.length) : 0, primary)}
          </div>
        </div>
      </div>

      {monthly.length > 0 && (
        <div className="section">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>{t('monthFilter')}</h3>
            <div className="row" style={{ gap: 4 }}>
              <button className="ghost" onClick={() => setSelectedMonths(null)}>{t('filterAll')}</button>
              <button className="ghost" onClick={() => setSelectedMonths(new Set())}>{t('filterNone')}</button>
            </div>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {monthly.map((m) => {
              const active = selectedMonths ? selectedMonths.has(m.key) : true;
              return (
                <button
                  key={m.key}
                  type="button"
                  className={active ? 'primary' : 'ghost'}
                  style={{ padding: '4px 10px', fontSize: '0.85rem' }}
                  onClick={() => toggleMonth(m.key)}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="muted" style={{ marginTop: 6 }}>{t('monthFilterHint')}</p>
        </div>
      )}

      <div className="section">
        <h3>{t('salaryVsBills')}</h3>
        {filteredMonthly.length === 0 ? (
          <p className="muted">{t('noDataForSelection')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={filteredMonthly}>
              <CartesianGrid stroke={chartGrid} />
              <XAxis dataKey="label" stroke={chartMuted} />
              <YAxis stroke={chartMuted} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: unknown) => formatMoney(Number(v), primary)}
              />
              <Legend />
              <Bar dataKey="salary" fill={chartAccent} />
              <Bar dataKey="bills" fill={chartWarn} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="section">
        <h3>{t('netSavings')}</h3>
        {filteredMonthly.length === 0 ? (
          <p className="muted">{t('noDataForSelection')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={filteredMonthly}>
              <CartesianGrid stroke={chartGrid} />
              <XAxis dataKey="label" stroke={chartMuted} />
              <YAxis stroke={chartMuted} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: unknown) => formatMoney(Number(v), primary)}
              />
              <Line type="monotone" dataKey="cumulativeNet" stroke={chartAccent} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="section">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>{t('spendingByCategory')}</h3>
          <div className="row">
            <label className="muted">{t('filter')}</label>
            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
            >
              <option value="">{t('allCategoriesOpt')}</option>
              {categoryTotals.map((c) => (
                <option key={c.name} value={c.name}>
                  {categoryLabel(t, c.name)}
                </option>
              ))}
            </select>
            {selectedCategory && (
              <button className="ghost" onClick={() => setSelectedCategory(null)}>
                {t('clear')}
              </button>
            )}
          </div>
        </div>

        {categoryTotals.length === 0 ? (
          <p className="muted">{t('noDataYet')}</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={categoryTotals}
                  dataKey="value"
                  nameKey="name"
                  outerRadius="70%"
                  label={renderPieLabel}
                  labelLine={false}
                  onClick={(d: { name?: string }) => {
                    if (d?.name) setSelectedCategory((prev) => (prev === d.name ? null : d.name!));
                  }}
                >
                  {categoryTotals.map((entry, i) => {
                    const isSelected = selectedCategory === entry.name;
                    const dimmed = selectedCategory && !isSelected;
                    return (
                      <Cell
                        key={entry.name}
                        fill={COLORS[i % COLORS.length]}
                        fillOpacity={dimmed ? 0.25 : 1}
                        stroke={isSelected ? '#fff' : 'none'}
                        strokeWidth={isSelected ? 2 : 0}
                        style={{ cursor: 'pointer' }}
                      />
                    );
                  })}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: unknown, _name: unknown, entry: { payload?: { name?: string } }) => [
                    formatMoney(Number(v), primary),
                    categoryLabel(t, entry?.payload?.name ?? ''),
                  ]}
                />
                <Legend
                  formatter={(value: string) => categoryLabel(t, value)}
                  onClick={(d: { value?: string }) => {
                    if (d?.value) setSelectedCategory((prev) => (prev === d.value ? null : d.value!));
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <p className="muted">{t('pieClickHint')}</p>
          </>
        )}
      </div>

      <div className="section">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>
            {selectedCategory ? t('billsInCat', { cat: categoryLabel(t, selectedCategory) }) : t('allBills')}
          </h3>
          <span className="muted">
            {billsForCategory.length || (selectedCategory ? 0 : t('allCategories'))}{' '}
            {selectedCategory && `· ${formatMoney(selectedTotal, primary)}`}
          </span>
        </div>
        {!selectedCategory ? (
          <p className="muted">{t('pickCatToSee')}</p>
        ) : billsForCategory.length === 0 ? (
          <p className="muted">{t('noBillsInCat')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('month')}</th>
                <th>{t('name')}</th>
                <th>{t('amount')}</th>
                <th>{t('card')}</th>
                <th>{t('account')}</th>
                <th>{t('source')}</th>
                <th>{t('paid')}</th>
              </tr>
            </thead>
            <tbody>
              {billsForCategory.map((b) => (
                <tr key={`${b.monthKey}-${b.id}`}>
                  <td data-label={t('month')}>{monthLabel(b.monthKey)}</td>
                  <td data-label={t('name')}>{b.name}</td>
                  <td data-label={t('amount')}>{formatMoney(b.amount, b.currency)}</td>
                  <td data-label={t('card')} className="muted">{cardName(b.creditCardId)}</td>
                  <td data-label={t('account')} className="muted">{accountName(b.accountId)}</td>
                  <td data-label={t('source')}>
                    <span className={`tag ${b.source === 'subscription' ? 'sub' : ''}`}>
                      {b.source}
                    </span>
                  </td>
                  <td data-label={t('paid')}>{b.paid ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
