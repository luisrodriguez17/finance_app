export type Currency = 'CRC' | 'USD';
export type Language = 'en' | 'es';

export interface Bill {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  category: string;
  source: 'manual' | 'subscription';
  subscriptionId?: string;
  creditCardId?: string;
  accountId?: string;
  /** Snapshot of what was deducted from the account when this was paid; used to refund on unpay/remove. */
  settledFrom?: { accountId: string; amount: number; currency: Currency };
  paid: boolean;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  category: string;
  active: boolean;
  creditCardId?: string;
  accountId?: string;
  /** First month (YYYY-MM) this subscription applies to. Undefined = no lower bound. */
  startMonth?: string;
  /** Number of months to run starting from startMonth. Undefined = unlimited. */
  totalMonths?: number;
  /** How often the subscription is charged, in months (1=monthly, 3=quarterly, 12=yearly). Undefined = monthly. */
  frequencyMonths?: number;
}

export interface MonthSnapshot {
  monthKey: string;
  salary: { amount: number; currency: Currency };
  startBalance?: { amount: number; currency: Currency };
  bills: Bill[];
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  currency: Currency;
}

export interface CreditCard {
  id: string;
  name: string;
  owedCRC: number;
  owedUSD: number;
}

export interface ImaginaryEntry {
  id: string;
  personName: string;
  amountCRC: number;
  amountUSD: number;
  description: string;
  date: string;
  collected: boolean;
}

export interface BudgetSlice {
  id: string;
  name: string;
  percentage: number;
}

export interface SavingsReserve {
  id: string;
  name: string;
  mode: 'percent' | 'fixed';
  value: number;
  currency: Currency;
}

export type SalaryCadence = 'monthly' | 'biweekly';

export interface SalarySchedule {
  enabled: boolean;
  amount: number;
  currency: Currency;
  cadence: SalaryCadence;
  /** Day of month for the (first) paycheck. 31 = last day of month. */
  day1: number;
  /** Second day of month for biweekly. */
  day2?: number;
  /** Optional account to deposit into when due. */
  accountId?: string;
  /** ISO YYYY-MM-DD dates that have already been applied. */
  appliedDates: string[];
}

export interface AppState {
  subscriptions: Subscription[];
  budget: BudgetSlice[];
  imaginary: ImaginaryEntry[];
  months: Record<string, MonthSnapshot>;
  categories: string[];
  primaryCurrency: Currency;
  exchangeRate: number;
  accounts: Account[];
  creditCards: CreditCard[];
  includeCreditCardInBills: boolean;
  includeImaginaryInDashboard: boolean;
  reserves: SavingsReserve[];
  salarySchedule: SalarySchedule;
  language: Language;
}
