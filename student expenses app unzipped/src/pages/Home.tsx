import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, DoorOpen, Home as HomeIcon, LogOut, Plus, Ticket, Users } from 'lucide-react';
import supabase from '../lib/supabase';
import { api, errMsg } from '../lib/api';
import type { Household, HouseholdSummary } from '../lib/types';
import { CURRENCIES } from '../lib/categories';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, EmptyState, ErrorBanner, Field, Logo, Skeleton, colorFor, describedBy, inputCls } from '../components/ui';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<HouseholdSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'none' | 'create' | 'join'>('none');

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await api<HouseholdSummary[]>('/api/households'));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-xl font-semibold">Student Expenses</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()} aria-label="Sign out">
          <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Sign out</span>
        </Button>
      </header>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm font-semibold text-muted">Signed in as {user?.email}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Your households</h1>
      </motion.div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant={panel === 'create' ? 'primary' : 'outline'} size="lg" onClick={() => setPanel(panel === 'create' ? 'none' : 'create')} aria-expanded={panel === 'create'}>
          <Plus className="size-5" aria-hidden /> New household
        </Button>
        <Button variant={panel === 'join' ? 'primary' : 'outline'} size="lg" onClick={() => setPanel(panel === 'join' ? 'none' : 'join')} aria-expanded={panel === 'join'}>
          <Ticket className="size-5" aria-hidden /> Join with code
        </Button>
      </div>

      {panel === 'create' && <CreateHousehold onCreated={(h) => navigate(`/h/${h.id}/members`, { state: { justCreated: true } })} />}
      {panel === 'join' && <JoinWithCode />}

      <div className="mt-8 space-y-3">
        {loading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-3xl" />)
        ) : error ? (
          <ErrorBanner title="Couldn’t load your households" message={error} onRetry={() => { setLoading(true); load(); }} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<HomeIcon className="size-6" aria-hidden />}
            title="No households yet"
            body="Create one for your flat or house, then share the invite link with your roommates. Got an invite code? Join instead."
            action={<>
              <Button onClick={() => setPanel('create')}><Plus className="size-4" aria-hidden /> Create household</Button>
              <Button variant="outline" onClick={() => setPanel('join')}>I have a code</Button>
            </>}
          />
        ) : (
          items.map((h, i) => (
            <motion.div key={h.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/h/${h.id}`}
                className="group flex items-center gap-4 rounded-3xl border border-line bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
                <span className="grid size-12 place-items-center rounded-2xl text-white" style={{ backgroundColor: colorFor(h.id) }}>
                  <HomeIcon className="size-6" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg font-semibold">{h.name}</span>
                  <span className="flex items-center gap-1.5 text-sm text-muted">
                    <Users className="size-3.5" aria-hidden /> {h.member_count} {h.member_count === 1 ? 'member' : 'members'} · {h.currency}
                    {h.my_role === 'owner' && <span className="ml-1 rounded-full bg-mustard-soft px-2 py-0.5 text-[11px] font-bold text-ink">Owner</span>}
                  </span>
                </span>
                <ChevronRight className="size-5 text-muted transition group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function CreateHousehold({ onCreated }: { onCreated: (h: Household) => void }) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [errors, setErrors] = useState<{ name?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErrors({ name: 'Give your household a name, like “Maple St Flat”.' }); return; }
    setBusy(true);
    setErrors({});
    try {
      onCreated(await api<Household>('/api/households', { method: 'POST', body: { name, displayName, currency } }));
    } catch (err) {
      setErrors({ form: errMsg(err) });
      setBusy(false);
    }
  };

  return (
    <Card className="mt-4">
      <form onSubmit={submit} noValidate className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Create a household</h2>
        <Field id="hh-name" label="Household name" error={errors.name}>
          <input id="hh-name" autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={inputCls(errors.name)}
            placeholder="e.g. Maple St Flat" aria-invalid={!!errors.name} aria-describedby={describedBy('hh-name', errors.name)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field id="hh-me" label="Your name in this household" optional hint="Defaults to the start of your email.">
            <input id="hh-me" maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls()} placeholder="e.g. Sam" aria-describedby="hh-me-hint" />
          </Field>
          <Field id="hh-cur" label="Currency">
            <select id="hh-cur" value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls()}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        {errors.form && <p role="alert" className="text-sm font-semibold text-rust">{errors.form}</p>}
        <Button type="submit" className="w-full" loading={busy}>Create household</Button>
      </form>
    </Card>
  );
}

function JoinWithCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const fromLink = code.match(/join\/([A-Za-z0-9]+)/)?.[1];
    const final = fromLink ? fromLink.toUpperCase() : c;
    if (final.length !== 8) { setError('Invite codes are 8 letters and numbers, like K7QM2PXA. You can also paste the whole link.'); return; }
    navigate(`/join/${final}`);
  };
  return (
    <Card className="mt-4">
      <form onSubmit={submit} noValidate className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Join a household</h2>
        <Field id="join-code" label="Invite code or link" error={error}>
          <input id="join-code" autoFocus value={code} onChange={(e) => { setCode(e.target.value); setError(undefined); }}
            className={`${inputCls(error)} font-mono uppercase tracking-widest`} placeholder="K7QM2PXA" autoCapitalize="characters" autoComplete="off"
            aria-invalid={!!error} aria-describedby={describedBy('join-code', error)} />
        </Field>
        <Button type="submit" className="w-full"><DoorOpen className="size-4" aria-hidden /> Continue</Button>
      </form>
    </Card>
  );
}
