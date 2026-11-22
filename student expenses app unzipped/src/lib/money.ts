import type { Expense, Member, Payment } from './types';

export const MAX_AMOUNT_CENTS = 100000000;

const formatters = new Map<string, Intl.NumberFormat>();
export function formatMoney(cents: number, currency = 'USD') {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    formatters.set(currency, f);
  }
  return f.format(cents / 100);
}

/** Parses "42", "42.5", "$1,200.00" into integer cents. Returns null if invalid. */
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/[\s,]/g, '').replace(/^[^\d.]+/, '');
  if (!s || s === '.' || !/^\d*(\.\d{0,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export const centsToInput = (c: number) => (c / 100).toFixed(2);

/** Splits total cents evenly; leftover cents go one each to the first people listed. */
export function splitEqual(total: number, ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!ids.length) return out;
  const base = Math.floor(total / ids.length);
  const rem = total - base * ids.length;
  ids.forEach((id, i) => (out[id] = base + (i < rem ? 1 : 0)));
  return out;
}

export interface Balance {
  memberId: string;
  paid: number;
  share: number;
  sent: number;
  received: number;
  /** positive = is owed money, negative = owes money */
  net: number;
}

export function computeBalances(members: Member[], expenses: Expense[], payments: Payment[]) {
  const b: Record<string, Balance> = {};
  for (const m of members) b[m.id] = { memberId: m.id, paid: 0, share: 0, sent: 0, received: 0, net: 0 };
  for (const e of expenses) {
    if (b[e.paid_by]) b[e.paid_by].paid += e.amount_cents;
    for (const s of e.expense_shares) if (b[s.member_id]) b[s.member_id].share += s.amount_cents;
  }
  for (const p of payments) {
    if (b[p.from_member]) b[p.from_member].sent += p.amount_cents;
    if (b[p.to_member]) b[p.to_member].received += p.amount_cents;
  }
  for (const x of Object.values(b)) x.net = x.paid - x.share + x.sent - x.received;
  return b;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/** Greedy matching of largest debtor to largest creditor — at most n-1 payments. */
export function suggestSettlements(balances: Balance[]): Transfer[] {
  const creditors = balances.filter((b) => b.net > 0).map((b) => ({ id: b.memberId, amt: b.net })).sort((a, b) => b.amt - a.amt);
  const debtors = balances.filter((b) => b.net < 0).map((b) => ({ id: b.memberId, amt: -b.net })).sort((a, b) => b.amt - a.amt);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const x = Math.min(d.amt, c.amt);
    if (x > 0) out.push({ from: d.id, to: c.id, amount: x });
    d.amt -= x;
    c.amt -= x;
    if (d.amt === 0) i++;
    if (c.amt === 0) j++;
  }
  return out;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function monthLabel(iso: string) {
  return new Date(`${iso.slice(0, 7)}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
