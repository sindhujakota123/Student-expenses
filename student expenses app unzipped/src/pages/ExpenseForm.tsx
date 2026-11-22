import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, FileQuestion, Info, Trash2, Wand2 } from 'lucide-react';
import { useHousehold } from '../contexts/HouseholdContext';
import { api, errMsg } from '../lib/api';
import { MAX_AMOUNT_CENTS, centsToInput, formatMoney, parseAmount, splitEqual, todayISO } from '../lib/money';
import { CATEGORIES } from '../lib/categories';
import type { Expense } from '../lib/types';
import { Avatar, Button, Card, ConfirmDialog, EmptyState, Field, describedBy, inputCls } from '../components/ui';
import { useToast } from '../components/Toast';

export default function ExpenseForm() {
  const { expenseId } = useParams();
  const { expenses, household } = useHousehold();
  if (expenseId) {
    const existing = expenses.find((e) => e.id === expenseId);
    if (!existing) {
      return (
        <EmptyState icon={<FileQuestion className="size-6" aria-hidden />} title="Expense not found"
          body="It may have been deleted by another member."
          action={<Link to={`/h/${household.id}/activity`} className="inline-flex h-11 items-center rounded-xl bg-ink px-4 font-semibold text-card">Back to history</Link>} />
      );
    }
    return <ExpenseFormInner key={existing.id} existing={existing} />;
  }
  return <ExpenseFormInner key="new" />;
}

type Errors = Partial<Record<'description' | 'amount' | 'date' | 'split', string>>;

function ExpenseFormInner({ existing }: { existing?: Expense }) {
  const { household, me, members, label, refresh } = useHousehold();
  const navigate = useNavigate();
  const toast = useToast();
  const cur = household.currency;
  const base = `/h/${household.id}`;

  const [description, setDescription] = useState(existing?.description ?? '');
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount_cents) : '');
  const [date, setDate] = useState(existing?.spent_on ?? todayISO());
  const [category, setCategory] = useState(existing?.category ?? 'Groceries');
  const [paidBy, setPaidBy] = useState(existing?.paid_by ?? me.id);
  const [splitType, setSplitType] = useState<'equal' | 'custom'>(existing?.split_type ?? 'equal');
  const [participants, setParticipants] = useState<string[]>(existing ? existing.expense_shares.map((s) => s.member_id) : members.map((m) => m.id));
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    existing ? Object.fromEntries(existing.expense_shares.map((s) => [s.member_id, centsToInput(s.amount_cents)])) : {});
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const amountCents = parseAmount(amount);
  const ordered = members.filter((m) => participants.includes(m.id)).map((m) => m.id);
  const equalShares = amountCents ? splitEqual(amountCents, ordered) : {};
  const customCents: Record<string, number | null> = {};
  for (const m of members) customCents[m.id] = (custom[m.id] ?? '').trim() === '' ? 0 : parseAmount(custom[m.id]);
  const customInvalid = members.filter((m) => customCents[m.id] === null).map((m) => m.id);
  const customSum = members.reduce((a, m) => a + (customCents[m.id] ?? 0), 0);
  const remaining = (amountCents ?? 0) - customSum;

  const errors: Errors = useMemo(() => {
    const e: Errors = {};
    if (!description.trim()) e.description = 'Add a short description, like “October rent”.';
    if (!amount.trim()) e.amount = 'Enter the total amount.';
    else if (amountCents === null) e.amount = 'Use a number like 42.50 (up to two decimals).';
    else if (amountCents <= 0) e.amount = 'Amount must be more than zero.';
    else if (amountCents > MAX_AMOUNT_CENTS) e.amount = 'That’s over the 1,000,000 limit.';
    if (!date) e.date = 'Pick the date of the expense.';
    if (splitType === 'equal') {
      if (!participants.length) e.split = 'Choose at least one person to share this cost.';
    } else if (customInvalid.length) {
      e.split = 'Fix the highlighted share amounts.';
    } else if (amountCents && amountCents > 0) {
      if (customSum === 0) e.split = 'Assign the total to at least one person.';
      else if (remaining > 0) e.split = `${formatMoney(remaining, cur)} still needs to be assigned.`;
      else if (remaining < 0) e.split = `Shares are ${formatMoney(-remaining, cur)} more than the total.`;
    }
    return e;
  }, [description, amount, amountCents, date, splitType, participants.length, customInvalid.length, customSum, remaining, cur]);

  const show = (k: keyof Errors) => (submitted || touched[k] ? errors[k] : undefined);
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const toggleParticipant = (id: string) =>
    setParticipants((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const switchSplit = (t: 'equal' | 'custom') => {
    if (t === 'custom' && Object.values(custom).every((v) => !v?.trim()) && amountCents) {
      setCustom(Object.fromEntries(Object.entries(equalShares).map(([k, v]) => [k, centsToInput(v)])));
    }
    setSplitType(t);
  };

  const fillRemainder = () => {
    if (!amountCents) return;
    const blanks = members.filter((m) => !(custom[m.id] ?? '').trim() || customCents[m.id] === 0).map((m) => m.id);
    const targets = blanks.length ? blanks : members.map((m) => m.id);
    if (remaining <= 0 && blanks.length) return;
    if (!blanks.length) {
      setCustom(Object.fromEntries(Object.entries(splitEqual(amountCents, targets)).map(([k, v]) => [k, centsToInput(v)])));
      return;
    }
    const add = splitEqual(remaining, targets);
    setCustom((c) => ({ ...c, ...Object.fromEntries(Object.entries(add).map(([k, v]) => [k, centsToInput(v)])) }));
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    setServerError(null);
    const firstError = (['description', 'amount', 'date', 'split'] as const).find((k) => errors[k]);
    if (firstError) {
      document.getElementById(firstError === 'split' ? 'split-section' : `exp-${firstError}`)?.focus();
      return;
    }
    const shares = splitType === 'equal'
      ? ordered.map((id) => ({ memberId: id, amountCents: equalShares[id] }))
      : members.filter((m) => (customCents[m.id] ?? 0) > 0).map((m) => ({ memberId: m.id, amountCents: customCents[m.id] as number }));
    const body = {
      householdId: household.id, description, amountCents, paidBy, splitType, category, spentOn: date, notes, shares,
    };
    setSaving(true);
    try {
      if (existing) await api('/api/expenses', { method: 'PUT', body: { ...body, id: existing.id } });
      else await api('/api/expenses', { method: 'POST', body });
      await refresh();
      toast(existing ? 'Expense updated' : 'Expense added');
      navigate(existing ? `${base}/activity` : base);
    } catch (e) {
      setServerError(errMsg(e));
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!existing) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api('/api/expenses', { method: 'DELETE', body: { id: existing.id } });
      await refresh();
      toast('Expense deleted');
      navigate(`${base}/activity`);
    } catch (e) {
      setDeleteError(errMsg(e));
      setDeleting(false);
    }
  };

  const splitErr = show('split');

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="grid size-10 place-items-center rounded-xl text-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-teal">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{existing ? 'Edit expense' : 'Add expense'}</h1>
      </div>

      {members.length < 2 && (
        <p className="flex items-start gap-2 rounded-2xl bg-mustard-soft p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>You’re the only member so far. <Link to={`${base}/members`} className="font-bold underline">Invite or add roommates</Link> to split costs with them.</span>
        </p>
      )}

      <Card className="space-y-4">
        <Field id="exp-description" label="Description" error={show('description')}>
          <input id="exp-description" maxLength={80} value={description} onChange={(e) => setDescription(e.target.value)} onBlur={() => touch('description')}
            className={inputCls(show('description'))} placeholder="e.g. Weekly groceries" aria-invalid={!!show('description')}
            aria-describedby={describedBy('exp-description', show('description'))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="exp-amount" label={`Total (${cur})`} error={show('amount')}>
            <input id="exp-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={() => touch('amount')}
              className={`${inputCls(show('amount'))} tabular font-display text-lg font-semibold`} placeholder="0.00" aria-invalid={!!show('amount')}
              aria-describedby={describedBy('exp-amount', show('amount'))} />
          </Field>
          <Field id="exp-date" label="Date" error={show('date')}>
            <input id="exp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} onBlur={() => touch('date')}
              className={inputCls(show('date'))} aria-invalid={!!show('date')} aria-describedby={describedBy('exp-date', show('date'))} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-bold">Category</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(({ name, icon: Icon }) => (
              <label key={name} className="cursor-pointer">
                <input type="radio" name="category" value={name} checked={category === name} onChange={() => setCategory(name)} className="peer sr-only" />
                <span className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm font-semibold text-muted transition peer-checked:border-ink peer-checked:bg-ink peer-checked:text-card peer-focus-visible:ring-2 peer-focus-visible:ring-teal peer-focus-visible:ring-offset-2 hover:border-ink/40">
                  <Icon className="size-4" aria-hidden /> {name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card>
        <fieldset>
          <legend className="mb-3 font-display text-lg font-semibold">Who paid?</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {members.map((m) => (
              <label key={m.id} className="cursor-pointer">
                <input type="radio" name="paidBy" value={m.id} checked={paidBy === m.id} onChange={() => setPaidBy(m.id)} className="peer sr-only" />
                <span className="flex min-h-12 items-center gap-2 rounded-2xl border-2 border-line bg-card px-3 py-2 text-sm font-semibold transition peer-checked:border-teal peer-checked:bg-teal-soft/60 peer-focus-visible:ring-2 peer-focus-visible:ring-teal peer-focus-visible:ring-offset-2 hover:border-ink/30">
                  <Avatar id={m.id} name={m.display_name} size="sm" placeholder={!m.user_id} />
                  <span className="truncate">{label(m.id)}</span>
                  {paidBy === m.id && <Check className="ml-auto size-4 shrink-0 text-teal" aria-hidden />}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card>
        <div id="split-section" tabIndex={-1} className="focus:outline-none" aria-describedby={splitErr ? 'split-error' : undefined}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Split</h2>
            <div role="radiogroup" aria-label="Split method" className="flex rounded-xl border border-line bg-paper p-1">
              {(['equal', 'custom'] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={splitType === t} onClick={() => switchSplit(t)}
                  className={`h-9 rounded-lg px-3 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-teal ${splitType === t ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
                  {t === 'equal' ? 'Equally' : 'Custom amounts'}
                </button>
              ))}
            </div>
          </div>

          {splitType === 'equal' ? (
            <>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted">{participants.length} of {members.length} sharing</span>
                <button type="button" className="font-bold text-teal hover:underline focus-visible:outline-2 focus-visible:outline-teal"
                  onClick={() => setParticipants(participants.length === members.length ? [] : members.map((m) => m.id))}>
                  {participants.length === members.length ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {members.map((m) => {
                  const on = participants.includes(m.id);
                  return (
                    <li key={m.id}>
                      <label className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2">
                        <input type="checkbox" checked={on} onChange={() => toggleParticipant(m.id)} className="size-5 rounded accent-teal" />
                        <Avatar id={m.id} name={m.display_name} size="sm" placeholder={!m.user_id} />
                        <span className={`flex-1 font-semibold ${on ? '' : 'text-muted'}`}>{label(m.id)}</span>
                        <span className={`tabular text-sm font-bold ${on ? '' : 'text-muted/60'}`}>
                          {on && amountCents ? formatMoney(equalShares[m.id] ?? 0, cur) : '—'}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {amountCents && ordered.length > 1 && amountCents % ordered.length !== 0 ? (
                <p className="mt-2 text-xs text-muted">Doesn’t divide evenly — the extra cent{amountCents % ordered.length > 1 ? 's go' : ' goes'} to the first {amountCents % ordered.length > 1 ? 'people' : 'person'} listed.</p>
              ) : null}
            </>
          ) : (
            <>
              <ul className="space-y-2">
                {members.map((m) => {
                  const bad = customInvalid.includes(m.id);
                  const id = `share-${m.id}`;
                  return (
                    <li key={m.id} className="flex items-center gap-3">
                      <Avatar id={m.id} name={m.display_name} size="sm" placeholder={!m.user_id} />
                      <label htmlFor={id} className="flex-1 truncate font-semibold">{label(m.id)}</label>
                      <input id={id} inputMode="decimal" value={custom[m.id] ?? ''} placeholder="0.00"
                        onChange={(e) => setCustom((c) => ({ ...c, [m.id]: e.target.value }))}
                        aria-invalid={bad} className={`${inputCls(bad)} tabular w-32 text-right font-semibold`} />
                    </li>
                  );
                })}
              </ul>
              <div className={`mt-3 flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold ${
                !amountCents ? 'bg-paper text-muted' : remaining === 0 ? 'bg-teal-soft text-teal' : 'bg-rust-soft text-rust'}`} aria-live="polite">
                <span>
                  {!amountCents ? 'Enter a total first'
                    : remaining === 0 ? <span className="flex items-center gap-1.5"><Check className="size-4" aria-hidden /> Adds up to {formatMoney(amountCents, cur)}</span>
                      : remaining > 0 ? `${formatMoney(remaining, cur)} left to assign` : `${formatMoney(-remaining, cur)} over the total`}
                </span>
                {!!amountCents && remaining !== 0 && (
                  <button type="button" onClick={fillRemainder} className="flex items-center gap-1 rounded-lg px-2 py-1 text-ink hover:bg-card focus-visible:outline-2 focus-visible:outline-teal">
                    <Wand2 className="size-3.5" aria-hidden /> {remaining > 0 ? 'Spread remainder' : 'Reset evenly'}
                  </button>
                )}
              </div>
            </>
          )}
          {splitErr && <p id="split-error" role="alert" className="mt-3 text-sm font-semibold text-rust">{splitErr}</p>}
        </div>
      </Card>

      <Card>
        <Field id="exp-notes" label="Notes" optional>
          <textarea id="exp-notes" maxLength={300} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            className={`${inputCls()} h-auto py-3`} placeholder="Anything to remember about this bill" />
        </Field>
      </Card>

      {serverError && <p role="alert" className="rounded-2xl bg-rust-soft px-4 py-3 text-sm font-semibold text-rust">{serverError}</p>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {existing && (
          <Button variant="outline" size="lg" className="text-rust" onClick={() => { setDeleteError(null); setConfirmDelete(true); }}>
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
        )}
        <Button type="submit" size="lg" className="w-full sm:flex-1" loading={saving}>{existing ? 'Save changes' : 'Add expense'}</Button>
      </div>

      <ConfirmDialog open={confirmDelete} title="Delete this expense?" confirmLabel="Delete expense" busy={deleting} error={deleteError}
        body={existing && <>“{existing.description}” ({formatMoney(existing.amount_cents, cur)}) will be removed for everyone and balances recalculated.</>}
        onConfirm={doDelete} onClose={() => !deleting && setConfirmDelete(false)} />
    </form>
  );
}
