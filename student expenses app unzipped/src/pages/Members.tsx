import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, Copy, LogOut, Pencil, RefreshCw, Share2, Trash2, UserPlus, X } from 'lucide-react';
import { useHousehold } from '../contexts/HouseholdContext';
import { api, errMsg } from '../lib/api';
import { formatMoney } from '../lib/money';
import type { Member } from '../lib/types';
import { Avatar, Button, Card, ConfirmDialog, Field, SectionTitle, describedBy, inputCls } from '../components/ui';
import { useToast } from '../components/Toast';

export default function Members() {
  const { household, me, members, balances, refresh } = useHousehold();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const cur = household.currency;
  const justCreated = (location.state as { justCreated?: boolean } | null)?.justCreated;
  const link = `${window.location.origin}/join/${household.invite_code}`;

  const [copied, setCopied] = useState(false);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string>();
  const [savingEdit, setSavingEdit] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [hhName, setHhName] = useState(household.name);
  const [hhError, setHhError] = useState<string>();
  const [hhSaving, setHhSaving] = useState(false);
  const [regen, setRegen] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Copy failed — select the link and copy it manually');
    }
  };
  const share = async () => {
    try { await navigator.share({ title: `Join ${household.name} on Student Expenses`, url: link }); } catch { /* user cancelled */ }
  };

  const addPlaceholder = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) { setAddError('Enter a name.'); return; }
    setAdding(true);
    setAddError(undefined);
    try {
      await api('/api/members', { method: 'POST', body: { householdId: household.id, displayName: newName } });
      await refresh();
      toast(`${newName.trim()} added`);
      setNewName('');
    } catch (err) {
      setAddError(errMsg(err));
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) { setEditError('Name cannot be empty.'); return; }
    setSavingEdit(true);
    try {
      await api('/api/members', { method: 'PUT', body: { id: editing, displayName: editName } });
      await refresh();
      setEditing(null);
      toast('Name updated');
    } catch (err) {
      setEditError(errMsg(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const doRemove = async () => {
    if (!removeTarget) return;
    setDialogBusy(true);
    setDialogError(null);
    try {
      await api('/api/members', { method: 'DELETE', body: { id: removeTarget.id } });
      await refresh();
      toast(`${removeTarget.display_name} removed`);
      setRemoveTarget(null);
    } catch (err) {
      setDialogError(errMsg(err));
    } finally {
      setDialogBusy(false);
    }
  };

  const doLeave = async () => {
    setDialogBusy(true);
    setDialogError(null);
    try {
      await api('/api/households', { method: 'DELETE', body: { id: household.id } });
      toast(`You left ${household.name}`);
      navigate('/', { replace: true });
    } catch (err) {
      setDialogError(errMsg(err));
      setDialogBusy(false);
    }
  };

  const saveHousehold = async (e: FormEvent) => {
    e.preventDefault();
    if (!hhName.trim()) { setHhError('Household name cannot be empty.'); return; }
    setHhSaving(true);
    setHhError(undefined);
    try {
      await api('/api/households', { method: 'PUT', body: { id: household.id, name: hhName } });
      await refresh();
      toast('Household renamed');
    } catch (err) {
      setHhError(errMsg(err));
    } finally {
      setHhSaving(false);
    }
  };

  const regenerate = async () => {
    setRegen(true);
    try {
      await api('/api/households', { method: 'PUT', body: { id: household.id, regenerateCode: true } });
      await refresh();
      toast('New invite code created — old links no longer work');
    } catch (err) {
      toast(errMsg(err));
    } finally {
      setRegen(false);
    }
  };

  const myNet = balances[me.id]?.net ?? 0;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Members</h1>

      <section className="relative overflow-hidden rounded-3xl border border-line bg-card">
        <div className="bg-teal p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-wider text-white/75">{justCreated ? 'Step 2 · Invite your roommates' : 'Invite roommates'}</p>
          <p className="mt-1 text-sm text-white/90">Anyone with this code can join <strong>{household.name}</strong> after signing in.</p>
          <p className="tabular mt-4 font-mono text-3xl font-bold tracking-[0.25em]" aria-label={`Invite code ${household.invite_code.split('').join(' ')}`}>{household.invite_code}</p>
        </div>
        <div className="perforation h-2 -translate-y-px rotate-180 bg-teal" aria-hidden />
        <div className="space-y-3 p-5 pt-3">
          <label htmlFor="invite-link" className="sr-only">Invite link</label>
          <input id="invite-link" readOnly value={link} onFocus={(e) => e.target.select()} className={`${inputCls()} truncate font-mono text-sm`} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={copy} className="flex-1">{copied ? <><Check className="size-4" aria-hidden /> Copied!</> : <><Copy className="size-4" aria-hidden /> Copy link</>}</Button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <Button variant="outline" onClick={share}><Share2 className="size-4" aria-hidden /> Share</Button>
            )}
            {me.role === 'owner' && (
              <Button variant="ghost" onClick={regenerate} loading={regen} title="Old links will stop working"><RefreshCw className="size-4" aria-hidden /> New code</Button>
            )}
          </div>
        </div>
      </section>

      <Card>
        <SectionTitle>People ({members.length})</SectionTitle>
        <ul className="divide-y divide-line">
          {members.map((m) => {
            const net = balances[m.id]?.net ?? 0;
            const canEdit = m.id === me.id || !m.user_id;
            return (
              <li key={m.id} className="py-3">
                {editing === m.id ? (
                  <form onSubmit={saveEdit} noValidate className="space-y-2">
                    <label htmlFor="edit-name" className="text-sm font-bold">Rename {m.display_name}</label>
                    <div className="flex gap-2">
                      <input id="edit-name" autoFocus maxLength={40} value={editName} onChange={(e) => { setEditName(e.target.value); setEditError(undefined); }}
                        className={inputCls(editError)} aria-invalid={!!editError} aria-describedby={describedBy('edit-name', editError)} />
                      <Button type="submit" loading={savingEdit} aria-label="Save name"><Check className="size-4" aria-hidden /></Button>
                      <Button variant="ghost" onClick={() => setEditing(null)} aria-label="Cancel"><X className="size-4" aria-hidden /></Button>
                    </div>
                    {editError && <p id="edit-name-error" className="text-sm font-semibold text-rust">{editError}</p>}
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <Avatar id={m.id} name={m.display_name} placeholder={!m.user_id} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                        <span className="truncate">{m.display_name}</span>
                        {m.id === me.id && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase text-card">You</span>}
                        {m.role === 'owner' && <span className="rounded-full bg-mustard-soft px-2 py-0.5 text-[10px] font-bold uppercase">Owner</span>}
                        {!m.user_id && <span className="rounded-full border border-dashed border-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted">Not joined</span>}
                      </p>
                      <p className={`tabular text-sm ${net > 0 ? 'text-teal' : net < 0 ? 'text-rust' : 'text-muted'}`}>
                        {net > 0 ? `Gets back ${formatMoney(net, cur)}` : net < 0 ? `Owes ${formatMoney(-net, cur)}` : 'Settled up'}
                      </p>
                    </div>
                    {canEdit && (
                      <button type="button" onClick={() => { setEditing(m.id); setEditName(m.display_name); setEditError(undefined); }} aria-label={`Rename ${m.display_name}`}
                        className="grid size-10 place-items-center rounded-lg text-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-teal">
                        <Pencil className="size-4" aria-hidden />
                      </button>
                    )}
                    {!m.user_id && (
                      <button type="button" onClick={() => { setDialogError(null); setRemoveTarget(m); }} aria-label={`Remove ${m.display_name}`}
                        className="grid size-10 place-items-center rounded-lg text-muted hover:bg-rust-soft hover:text-rust focus-visible:outline-2 focus-visible:outline-teal">
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <form onSubmit={addPlaceholder} noValidate className="mt-4 border-t border-line pt-4">
          <Field id="new-member" label="Add someone who hasn’t signed up yet" error={addError}
            hint="They can claim this spot later when they join with the invite link.">
            <div className="flex gap-2">
              <input id="new-member" maxLength={40} value={newName} onChange={(e) => { setNewName(e.target.value); setAddError(undefined); }}
                className={inputCls(addError)} placeholder="e.g. Jordan" aria-invalid={!!addError} aria-describedby={describedBy('new-member', addError, true)} />
              <Button type="submit" loading={adding} className="shrink-0"><UserPlus className="size-4" aria-hidden /> Add</Button>
            </div>
          </Field>
        </form>
      </Card>

      <Card>
        <SectionTitle>Household settings</SectionTitle>
        <form onSubmit={saveHousehold} noValidate className="space-y-2">
          <Field id="hh-rename" label="Household name" error={hhError} hint={`Amounts are in ${cur}.`}>
            <div className="flex gap-2">
              <input id="hh-rename" maxLength={60} value={hhName} onChange={(e) => { setHhName(e.target.value); setHhError(undefined); }}
                className={inputCls(hhError)} aria-invalid={!!hhError} aria-describedby={describedBy('hh-rename', hhError, true)} />
              <Button type="submit" variant="outline" loading={hhSaving} disabled={hhName.trim() === household.name} className="shrink-0">Save</Button>
            </div>
          </Field>
        </form>
        <div className="mt-5 border-t border-line pt-4">
          <Button variant="outline" className="w-full text-rust" onClick={() => { setDialogError(null); setLeaving(true); }}>
            <LogOut className="size-4" aria-hidden /> Leave household
          </Button>
        </div>
      </Card>

      <ConfirmDialog open={!!removeTarget} title={`Remove ${removeTarget?.display_name ?? ''}?`} confirmLabel="Remove" busy={dialogBusy} error={dialogError}
        body="They haven’t joined yet. People who are part of existing expenses or payments can’t be removed until those are edited."
        onConfirm={doRemove} onClose={() => !dialogBusy && setRemoveTarget(null)} />
      <ConfirmDialog open={leaving} title={`Leave ${household.name}?`} confirmLabel="Leave household" busy={dialogBusy} error={dialogError}
        body={<>
          You’ll lose access immediately. Your past expenses stay in the history under your name so balances remain correct, and you can rejoin later with an invite and reclaim your spot.
          {myNet !== 0 && <strong className="mt-2 block text-rust">Heads up: you {myNet > 0 ? 'are owed' : 'still owe'} {formatMoney(Math.abs(myNet), cur)}.</strong>}
        </>}
        onConfirm={doLeave} onClose={() => !dialogBusy && setLeaving(false)} />
    </div>
  );
}
