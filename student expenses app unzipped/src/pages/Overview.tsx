import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCircle2, PartyPopper, Plus, Receipt, UserPlus } from 'lucide-react';
import { useHousehold } from '../contexts/HouseholdContext';
import { formatMoney, suggestSettlements, todayISO } from '../lib/money';
import { Avatar, Card, EmptyState, SectionTitle } from '../components/ui';
import { ActivityRow, buildActivity } from '../components/ActivityRow';

export default function Overview() {
  const { household, me, members, expenses, payments, balances, label, memberById } = useHousehold();
  const location = useLocation();
  const cur = household.currency;
  const base = `/h/${household.id}`;
  const myNet = balances[me.id]?.net ?? 0;

  const transfers = useMemo(() => {
    const t = suggestSettlements(Object.values(balances));
    return t.sort((a, b) => Number(b.from === me.id || b.to === me.id) - Number(a.from === me.id || a.to === me.id));
  }, [balances, me.id]);
  const maxAbs = Math.max(1, ...Object.values(balances).map((b) => Math.abs(b.net)));
  const month = todayISO().slice(0, 7);
  const monthTotal = expenses.filter((e) => e.spent_on.startsWith(month)).reduce((a, e) => a + e.amount_cents, 0);
  const recent = buildActivity(expenses, payments).slice(0, 5);
  const justJoined = (location.state as { justCreated?: boolean } | null)?.justCreated;

  if (expenses.length === 0 && payments.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Balances</h1>
        <EmptyState
          icon={<Receipt className="size-6" aria-hidden />}
          title={justJoined ? 'Your household is ready' : 'No expenses yet'}
          body={members.length < 2
            ? 'Invite your roommates (or add them as placeholders), then log the first shared bill.'
            : 'Add the first shared bill — rent, groceries, utilities — and balances will appear here.'}
          action={<>
            <Link to={`${base}/expenses/new`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-4 font-semibold text-card"><Plus className="size-4" aria-hidden /> Add expense</Link>
            {members.length < 2 && <Link to={`${base}/members`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-card px-4 font-semibold"><UserPlus className="size-4" aria-hidden /> Invite people</Link>}
          </>}
        />
      </div>
    );
  }

  const status = myNet > 0
    ? { label: 'You’re owed', cls: 'text-teal', bg: 'bg-teal-soft', icon: <ArrowDownLeft className="size-5" aria-hidden /> }
    : myNet < 0
      ? { label: 'You owe', cls: 'text-rust', bg: 'bg-rust-soft', icon: <ArrowUpRight className="size-5" aria-hidden /> }
      : { label: 'You’re settled up', cls: 'text-ink', bg: 'bg-mustard-soft', icon: <CheckCircle2 className="size-5" aria-hidden /> };

  return (
    <div className="space-y-5">
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-ink p-6 text-card shadow-xl shadow-ink/15">
        <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-teal/40 blur-3xl" aria-hidden />
        <p className="relative flex items-center gap-2 text-sm font-semibold text-card/75">
          <span className={`grid size-8 place-items-center rounded-full ${status.bg} ${status.cls}`}>{status.icon}</span>
          {status.label}
        </p>
        <p className="tabular relative mt-3 font-display text-5xl font-semibold tracking-tight" aria-live="polite">
          {myNet === 0 ? formatMoney(0, cur) : formatMoney(Math.abs(myNet), cur)}
        </p>
        <div className="relative mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-card/70">
          <span>This month: <strong className="tabular text-card">{formatMoney(monthTotal, cur)}</strong></span>
          <span>{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'} logged</span>
        </div>
      </motion.section>

      <Card>
        <SectionTitle action={transfers.length > 0 && <span className="text-xs font-semibold text-muted">{transfers.length} {transfers.length === 1 ? 'payment' : 'payments'} settles everyone</span>}>
          Settle-up plan
        </SectionTitle>
        {transfers.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl bg-teal-soft/60 p-4">
            <PartyPopper className="size-6 text-teal" aria-hidden />
            <p className="text-sm font-semibold">Everyone is square. Nothing to settle.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {transfers.map((t) => {
              const mine = t.from === me.id || t.to === me.id;
              return (
                <li key={`${t.from}-${t.to}`} className={`flex items-center gap-3 rounded-2xl border p-3 ${mine ? 'border-teal/40 bg-teal-soft/40' : 'border-line'}`}>
                  <div className="flex shrink-0 items-center -space-x-1.5">
                    <Avatar id={t.from} name={memberById[t.from]?.display_name ?? '?'} size="sm" placeholder={!memberById[t.from]?.user_id} />
                    <Avatar id={t.to} name={memberById[t.to]?.display_name ?? '?'} size="sm" placeholder={!memberById[t.to]?.user_id} />
                  </div>
                  <p className="min-w-0 flex-1 text-sm">
                    <strong>{label(t.from)}</strong> {t.from === me.id ? 'pay' : 'pays'} <strong>{label(t.to)}</strong>
                    <span className="tabular block font-display text-lg font-semibold">{formatMoney(t.amount, cur)}</span>
                  </p>
                  <Link to={`${base}/settle?from=${t.from}&to=${t.to}&amount=${t.amount}`}
                    className="inline-flex h-10 items-center gap-1 rounded-xl bg-ink px-3 text-sm font-semibold text-card hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                    aria-label={`Record payment of ${formatMoney(t.amount, cur)} from ${label(t.from)} to ${label(t.to)}`}>
                    Record <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Everyone’s balance</SectionTitle>
        <ul className="divide-y divide-line">
          {members.map((m) => {
            const b = balances[m.id];
            const net = b?.net ?? 0;
            const pct = Math.round((Math.abs(net) / maxAbs) * 100);
            const word = net > 0 ? 'gets back' : net < 0 ? 'owes' : 'settled up';
            return (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Avatar id={m.id} name={m.display_name} placeholder={!m.user_id} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.display_name}{m.id === me.id && <span className="ml-1.5 text-xs font-bold text-muted">(you)</span>}</p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-paper" aria-hidden>
                    <div className={`h-full rounded-full ${net >= 0 ? 'bg-teal' : 'bg-rust'}`} style={{ width: `${net === 0 ? 0 : Math.max(pct, 4)}%` }} />
                  </div>
                </div>
                <div className="w-28 text-right">
                  <p className={`flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-wide ${net > 0 ? 'text-teal' : net < 0 ? 'text-rust' : 'text-muted'}`}>
                    {net > 0 ? <ArrowDownLeft className="size-3" aria-hidden /> : net < 0 ? <ArrowUpRight className="size-3" aria-hidden /> : null}
                    {word}
                  </p>
                  <p className="tabular font-bold">{formatMoney(Math.abs(net), cur)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <SectionTitle action={<Link to={`${base}/activity`} className="text-sm font-bold text-teal hover:underline">See all</Link>}>Recent activity</SectionTitle>
        <div className="divide-y divide-line">
          {recent.map((it) => <ActivityRow key={it.kind + (it.kind === 'expense' ? it.e.id : it.p.id)} item={it} />)}
        </div>
      </Card>
    </div>
  );
}
