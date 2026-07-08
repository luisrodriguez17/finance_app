import type { Currency, PendingBill } from '../types';

export interface ParsedTransaction {
  amount: number;
  currency: Currency;
  merchant: string;
}

/** Normalize "5,000.50", "5.000,50", "5 000" etc. into a number. */
function parseAmount(raw: string): number {
  let s = raw.replace(/\s/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal point.
    const dec = Math.max(lastComma, lastDot);
    s = s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1);
  } else if (lastComma > -1) {
    // Single comma: decimal if followed by 1-2 digits, else thousands.
    s = s.length - lastComma - 1 <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (lastDot > -1 && s.length - lastDot - 1 === 3) {
    // "5.000" is almost certainly thousands in CRC contexts.
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

const AMOUNT_PATTERNS: { re: RegExp; currency: Currency }[] = [
  { re: /(?:₡|¢|CRC\s?|colones\s?)([\d][\d.,\s]*)/i, currency: 'CRC' },
  { re: /(?:\$|USD\s?|US\$\s?)([\d][\d.,\s]*)/i, currency: 'USD' },
  { re: /([\d][\d.,\s]*)\s?(?:colones|CRC)/i, currency: 'CRC' },
  { re: /([\d][\d.,\s]*)\s?(?:dólares|dolares|USD)/i, currency: 'USD' },
];

const MERCHANT_PATTERNS: RegExp[] = [
  /(?:\bat|\ben|\bcomercio:?|\bmerchant:?)\s+([A-ZÁÉÍÓÚÑ0-9][^\n.,;]{1,40})/i,
  /(?:compra en|purchase at|pago a|payment to)\s+([^\n.,;]{2,40})/i,
];

/**
 * Extract amount/currency/merchant from free text such as
 * "You spent ₡5,000 at Automercado" or a bank transaction email.
 */
export function parseTransactionText(text: string): ParsedTransaction | null {
  for (const { re, currency } of AMOUNT_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const amount = parseAmount(m[1]);
    if (amount <= 0) continue;
    let merchant = '';
    for (const mp of MERCHANT_PATTERNS) {
      const mm = text.match(mp);
      if (mm) {
        merchant = mm[1].trim();
        break;
      }
    }
    return { amount, currency, merchant: merchant || 'Unknown' };
  }
  return null;
}

const newId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function toPendingBill(
  text: string,
  source: PendingBill['source'],
  capturedAt?: number
): PendingBill | null {
  const parsed = parseTransactionText(text);
  if (!parsed) return null;
  return {
    id: newId(),
    amount: parsed.amount,
    currency: parsed.currency,
    merchant: parsed.merchant,
    capturedAt: new Date(capturedAt ?? Date.now()).toISOString(),
    source,
    raw: text.slice(0, 500),
  };
}
