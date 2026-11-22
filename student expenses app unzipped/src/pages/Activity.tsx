import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, SearchX, ScrollText } from 'lucide-react';
import { useHousehold } from '../contexts/HouseholdContext';
import { api, errMsg } from '../lib/api';
import { formatMoney, monthLabel } from '../lib/money';
import type { Payment } from '../lib/types';
import { ActivityRow, buildActivity } from '../components/ActivityRow';
import { Card, ConfirmDialog, EmptyState, inputCls } from '../components/ui';
import { useToast } from '../components/Toast';

type Kind = 'all' | 'expense' | 'payment';

export default function Activity() {
  const { household, members, expenses, payments, label, refresh } = useHousehold();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>('all');
  const [person, setPerson] = useState('');
  const [q, setQ] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const all = useMemo(() => buildActivity(expenses, payments), [expenses, payments]);
  const filtered = all.filter((it) => {
    if (kind !== 'all' && it.kind !== kind) return false;
    if (person) {
      const involved = it.kind === 'expense'
        ? it.e.paid_by === person || it.e.expense_shares.some((s) => s.member_id === person)
        : it.p.from_member === person || it.p.to_member === person;
      if (!involved) return false;
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      const hay = it.kind === 'expense'
        ? `${it.e.description} ${it.e.category} ${it.e.notes ?? ''}`
        : `payment ${label(it.p.from_member)} ${label(it.p.to_member)} ${it.p.note ?? ''}`;
      if (!hay.toLowerCase().includes(needle)) return false;
    }
    return true;
  });

  const groups: { month: string; items: typeof filtered; total: number }[] = [];
  for (const it of filtered) {
    const m = it.date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.month !== m) { g = { month: m, items: [], total: 0 }; groups.push(g); }
    g.items.push(it);
    if (it.kind === 'expense') g.total += it.e.amount_cents;
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api('/api/payments', { method: 'DELETE', body: { id: pendingDelete.id } });
      await refresh();
      toast('Payment deleted');
      setPendingDelete(null);
    } catch (e) {
      setDeleteError(errMsg(e));
    } finally {
      setDeleting(false);
    }
  };

  const chips: { k: Kind; label: string; n: number }[] = [
    { k: 'all', label: 'All', n: all.length },
    { k: 'expense', label: 'Expenses', n: expenses.length },
    { k: 'payment', label: 'Payments', n: payments.length },
  ];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-semibold tracking-tight">History</h1>

      {all.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-6" aria-hidden />} title="Nothing here yet"
          body="Expenses and settle-up payments will appear here as a timeline."
          action={<Link to={`/h/${household.id}/expenses/new`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-4 font-semibold text-card"><Plus className="size-4" aria-hidden /> Add expense</Link>} />
      ) : (
        <>
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <label htmlFor="search" className="sr-only">Search history</label>
              <input id="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search descriptions, notes…" className={`${inputCls()} pl-10`} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Filter by type" className="flex rounded-xl border border-line bg-card p-1">
                {chips.map((c) => (
                  <button key={c.k} type="button" aria-pressed={kind === c.k} onClick={() => setKind(c.k)}
                    className={`h-9 rounded-lg px-3 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-teal ${kind === c.k ? 'bg-ink text-card' : 'text-muted hover:text-ink'}`}>
                    {c.label} <span className="opacity-60">{c.n}</span>
                  </button>
                ))}
              </div>
              <label htmlFor="person" className="sr-only">Filter by person</label>
              <select id="person" value={person} onChange={(e) => setPerson(e.target.value)} className="h-11 flex-1 rounded-xl border border-line bg-card px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal/25 sm:flex-none">
                <option value="">Everyone</option>
                {members.map((m) => <option key={m.id} value={m.id}>Involving {label(m.id) === 'You' ? 'me' : m.display_name}</option>)}
              </select>
            </div>
          </div>

          <p className="sr-only" aria-live="polite">{filtered.length} results</p>

          {filtered.length === 0 ? (
            <EmptyState icon={<SearchX className="size-6" aria-hidden />} title="No matches" body="Try a different search or clear the filters."
              action={<button type="button" onClick={() => { setKind('all'); setPerson(''); setQ(''); }} className="inline-flex h-11 items-center rounded-xl border border-line bg-card px-4 font-semibold">Clear filters</button>} />
          ) : (
            groups.map((g) => (
              <Card key={g.month} className="p-4 sm:p-5">
                <div className="mb-1 flex items-baseline justify-between">
                  <h2 className="font-display text-lg font-semibold">{monthLabel(g.month)}</h2>
                  {g.total > 0 && <span className="tabular text-sm font-semibold text-muted">{formatMoney(g.total, household.currency)} spent</span>}
                </div>
                <div className="divide-y divide-line">
                  {g.items.map((it) => (
                    <ActivityRow key={it.kind + (it.kind === 'expense' ? it.e.id : it.p.id)} item={it}
                      onDeletePayment={(p) => { setDeleteError(null); setPendingDelete(p); }} />
                  ))}
                </div>
              </Card>
            ))
          )}
        </>
      )}

      <ConfirmDialog open={!!pendingDelete} title="Delete this payment?" confirmLabel="Delete payment" busy={deleting} error={deleteError}
        body={pendingDelete && <>The {formatMoney(pendingDelete.amount_cents, household.currency)} payment from {label(pendingDelete.from_member)} to {label(pendingDelete.to_member)} will be removed and balances recalculated.</>}
        onConfirm={confirmDelete} onClose={() => !deleting && setPendingDelete(null)} />
    </div>
  );
}
