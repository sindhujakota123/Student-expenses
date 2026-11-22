import { Link } from 'react-router-dom';
import { ArrowRight, HandCoins, Trash2 } from 'lucide-react';
import type { Expense, Payment } from '../lib/types';
import { formatDate, formatMoney } from '../lib/money';
import { iconFor } from '../lib/categories';
import { useHousehold } from '../contexts/HouseholdContext';

export type ActivityItem =
  | { kind: 'expense'; date: string; created: string; e: Expense }
  | { kind: 'payment'; date: string; created: string; p: Payment };

export function buildActivity(expenses: Expense[], payments: Payment[]): ActivityItem[] {
  const items: ActivityItem[] = [
    ...expenses.map((e) => ({ kind: 'expense' as const, date: e.spent_on, created: e.created_at, e })),
    ...payments.map((p) => ({ kind: 'payment' as const, date: p.paid_on, created: p.created_at, p })),
  ];
  return items.sort((a, b) => (a.date === b.date ? (a.created < b.created ? 1 : -1) : a.date < b.date ? 1 : -1));
}

export function ActivityRow({ item, onDeletePayment }: { item: ActivityItem; onDeletePayment?: (p: Payment) => void }) {
  const { household, me, label } = useHousehold();
  const cur = household.currency;

  if (item.kind === 'payment') {
    const p = item.p;
    return (
      <div className="flex items-center gap-3 px-1 py-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-soft text-teal"><HandCoins className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1 font-semibold">
            {label(p.from_member)} <ArrowRight className="size-3.5 text-muted" aria-label="paid" /> {label(p.to_member)}
          </p>
          <p className="truncate text-sm text-muted">Payment · {formatDate(p.paid_on)}{p.note ? ` · ${p.note}` : ''}</p>
        </div>
        <p className="tabular font-bold text-teal">{formatMoney(p.amount_cents, cur)}</p>
        {onDeletePayment && (
          <button type="button" onClick={() => onDeletePayment(p)} aria-label={`Delete payment from ${label(p.from_member)} to ${label(p.to_member)}`}
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-rust-soft hover:text-rust focus-visible:outline-2 focus-visible:outline-teal">
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  const e = item.e;
  const Icon = iconFor(e.category);
  const myShare = e.expense_shares.find((s) => s.member_id === me.id)?.amount_cents ?? 0;
  let note: { text: string; cls: string };
  if (e.paid_by === me.id) {
    const lent = e.amount_cents - myShare;
    note = lent > 0 ? { text: `you lent ${formatMoney(lent, cur)}`, cls: 'text-teal' } : { text: 'just you', cls: 'text-muted' };
  } else if (myShare > 0) {
    note = { text: `you owe ${formatMoney(myShare, cur)}`, cls: 'text-rust' };
  } else {
    note = { text: 'not involved', cls: 'text-muted' };
  }

  return (
    <Link to={`/h/${household.id}/expenses/${e.id}`}
      className="-mx-1 flex items-center gap-3 rounded-2xl px-2 py-3 transition hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-mustard-soft text-ink"><Icon className="size-5" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{e.description}</p>
        <p className="truncate text-sm text-muted">{label(e.paid_by)} paid · {formatDate(e.spent_on)}</p>
      </div>
      <div className="text-right">
        <p className="tabular font-bold">{formatMoney(e.amount_cents, cur)}</p>
        <p className={`tabular text-xs font-semibold ${note.cls}`}>{note.text}</p>
      </div>
    </Link>
  );
}
