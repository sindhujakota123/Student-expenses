import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, HandCoins, PartyPopper } from 'lucide-react';
import { useHousehold } from '../contexts/HouseholdContext';
import { api, errMsg } from '../lib/api';
import { MAX_AMOUNT_CENTS, centsToInput, formatMoney, parseAmount, suggestSettlements, todayISO } from '../lib/money';
import { Avatar, Button, Card, Field, describedBy, inputCls } from '../components/ui';
import { useToast } from '../components/Toast';

export default function SettleForm() {
  const { household, me, members, balances, label, memberById, refresh } = useHousehold();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const cur = household.currency;
  const valid = (id: string | null) => (id && memberById[id] ? id : '');

  const transfers = useMemo(() => suggestSettlements(Object.values(balances)), [balances]);
  const prefillAmount = Number(params.get('amount'));
  const [from, setFrom] = useState(valid(params.get('from')) || me.id);
  const [to, setTo] = useState(valid(params.get('to')));
  const [amount, setAmount] = useState(prefillAmount > 0 ? centsToInput(prefillAmount) : '');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const cents = parseAmount(amount);
  const errors: Partial<Record<'from' | 'to' | 'amount' | 'date', string>> = {};
  if (!from) errors.from = 'Choose who paid.';
  if (!to) errors.to = 'Choose who received the money.';
  else if (to === from) errors.to = 'Payer and recipient must be different people.';
  if (!amount.trim()) errors.amount = 'Enter the amount paid.';
  else if (cents === null) errors.amount = 'Use a number like 25.00 (up to two decimals).';
  else if (cents <= 0) errors.amount = 'Amount must be more than zero.';
  else if (cents > MAX_AMOUNT_CENTS) errors.amount = 'That’s over the 1,000,000 limit.';
  if (!date) errors.date = 'Pick a date.';
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  const owedBetween = transfers.find((t) => t.from === from && t.to === to)?.amount;

  const pick = (t: { from: string; to: string; amount: number }) => {
    setFrom(t.from);
    setTo(t.to);
    setAmount(centsToInput(t.amount));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setServerError(null);
    const first = (['from', 'to', 'amount', 'date'] as const).find((k) => errors[k]);
    if (first) { document.getElementById(`pay-${first}`)?.focus(); return; }
    setSaving(true);
    try {
      await api('/api/payments', {
        method: 'POST',
        body: { householdId: household.id, fromMember: from, toMember: to, amountCents: cents, paidOn: date, note },
      });
      await refresh();
      toast(`Recorded ${formatMoney(cents as number, cur)} payment`);
      navigate(`/h/${household.id}`);
    } catch (err) {
      setServerError(errMsg(err));
      setSaving(false);
    }
  };

  const selectCls = (err?: string) => `${inputCls(err)} font-semibold`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settle up</h1>
        <p className="mt-1 text-sm text-muted">Record money that changed hands outside the app (cash, bank transfer, payment app).</p>
      </div>

      {members.length > 1 && (
        <Card>
          <h2 className="mb-3 font-display text-lg font-semibold">Suggested payments</h2>
          {transfers.length === 0 ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-teal"><PartyPopper className="size-5" aria-hidden /> Everyone is square right now.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {transfers.map((t) => {
                const active = t.from === from && t.to === to;
                return (
                  <button key={`${t.from}-${t.to}`} type="button" onClick={() => pick(t)} aria-pressed={active}
                    className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-teal ${active ? 'border-teal bg-teal-soft/60' : 'border-line hover:border-ink/30'}`}>
                    <span><strong>{label(t.from)}</strong> → <strong>{label(t.to)}</strong></span>
                    <span className="tabular font-bold">{formatMoney(t.amount, cur)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <form onSubmit={submit} noValidate>
        <Card className="space-y-4">
          <Field id="pay-from" label="Who paid" error={show('from')}>
            <div className="flex items-center gap-3">
              {from && <Avatar id={from} name={memberById[from].display_name} placeholder={!memberById[from].user_id} />}
              <select id="pay-from" value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls(show('from'))}
                aria-invalid={!!show('from')} aria-describedby={describedBy('pay-from', show('from'))}>
                <option value="">Choose a person…</option>
                {members.map((m) => <option key={m.id} value={m.id}>{label(m.id)}{m.id === me.id ? ` (${m.display_name})` : ''}</option>)}
              </select>
            </div>
          </Field>
          <div className="flex justify-center text-muted" aria-hidden><ArrowDown className="size-5" /></div>
          <Field id="pay-to" label="Who received it" error={show('to')}>
            <div className="flex items-center gap-3">
              {to && <Avatar id={to} name={memberById[to].display_name} placeholder={!memberById[to].user_id} />}
              <select id="pay-to" value={to} onChange={(e) => setTo(e.target.value)} className={selectCls(show('to'))}
                aria-invalid={!!show('to')} aria-describedby={describedBy('pay-to', show('to'))}>
                <option value="">Choose a person…</option>
                {members.map((m) => <option key={m.id} value={m.id}>{label(m.id)}{m.id === me.id ? ` (${m.display_name})` : ''}</option>)}
              </select>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="pay-amount" label={`Amount (${cur})`} error={show('amount')}
              hint={owedBetween ? <button type="button" className="font-bold text-teal hover:underline" onClick={() => setAmount(centsToInput(owedBetween))}>Use suggested {formatMoney(owedBetween, cur)}</button> : undefined}>
              <input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                className={`${inputCls(show('amount'))} tabular font-display text-lg font-semibold`} aria-invalid={!!show('amount')}
                aria-describedby={describedBy('pay-amount', show('amount'), owedBetween)} />
            </Field>
            <Field id="pay-date" label="Date" error={show('date')}>
              <input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls(show('date'))}
                aria-invalid={!!show('date')} aria-describedby={describedBy('pay-date', show('date'))} />
            </Field>
          </div>
          <Field id="pay-note" label="Note" optional>
            <input id="pay-note" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls()} placeholder="e.g. Bank transfer" />
          </Field>
          {serverError && <p role="alert" className="rounded-xl bg-rust-soft px-3 py-2.5 text-sm font-semibold text-rust">{serverError}</p>}
          <Button type="submit" variant="accent" size="lg" className="w-full" loading={saving}>
            <HandCoins className="size-5" aria-hidden /> Record payment
          </Button>
        </Card>
      </form>
    </div>
  );
}
