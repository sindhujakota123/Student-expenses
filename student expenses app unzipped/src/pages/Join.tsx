import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Home as HomeIcon, UserPlus } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { Avatar, Button, Card, ErrorBanner, Field, FullPageSpinner, Logo, describedBy, inputCls } from '../components/ui';
import { useToast } from '../components/Toast';

interface Preview {
  household: { id: string; name: string; currency: string };
  memberCount: number;
  alreadyMember: boolean;
  placeholders: { id: string; display_name: string }[];
  suggestedName: string;
}

export default function Join() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choice, setChoice] = useState<string>('new');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const p = await api<Preview>(`/api/join?code=${encodeURIComponent(code)}`);
      setPreview(p);
      setName(p.suggestedName);
    } catch (e) {
      setLoadError(errMsg(e));
    }
  }, [code]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (choice === 'new' && !name.trim()) { setNameError('Enter the name your roommates know you by.'); return; }
    setBusy(true);
    setFormError(null);
    try {
      const r = await api<{ householdId: string }>('/api/join', {
        method: 'POST',
        body: choice === 'new' ? { code, displayName: name } : { code, claimMemberId: choice },
      });
      toast(`Welcome to ${preview?.household.name}!`);
      navigate(`/h/${r.householdId}`, { replace: true });
    } catch (err) {
      setFormError(errMsg(err));
      setBusy(false);
    }
  };

  if (!preview && !loadError) return <FullPageSpinner label="Looking up your invite…" />;

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 py-8">
      <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> My households
      </Link>
      {loadError ? (
        <ErrorBanner title="Invite not found" message={loadError} onRetry={load} />
      ) : preview && (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Logo className="size-10" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">You’re invited to</p>
              <h1 className="font-display text-2xl font-semibold">{preview.household.name}</h1>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">{preview.memberCount} {preview.memberCount === 1 ? 'person' : 'people'} · amounts in {preview.household.currency}</p>

          {preview.alreadyMember ? (
            <div className="mt-6">
              <p className="rounded-xl bg-teal-soft px-3 py-2.5 text-sm font-semibold text-teal">You’re already a member of this household.</p>
              <Button className="mt-4 w-full" onClick={() => navigate(`/h/${preview.household.id}`)}><HomeIcon className="size-4" aria-hidden /> Open household</Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-6 space-y-4">
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-bold">Who are you?</legend>
                {preview.placeholders.length > 0 && (
                  <p className="text-xs text-muted">If someone already added you, pick your name so your existing expenses carry over.</p>
                )}
                {preview.placeholders.map((p) => (
                  <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${choice === p.id ? 'border-teal bg-teal-soft/50' : 'border-line hover:border-ink/30'}`}>
                    <input type="radio" name="who" value={p.id} checked={choice === p.id} onChange={() => setChoice(p.id)} className="size-4 accent-teal" />
                    <Avatar id={p.id} name={p.display_name} size="sm" placeholder />
                    <span className="font-semibold">I’m {p.display_name}</span>
                  </label>
                ))}
                <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${choice === 'new' ? 'border-teal bg-teal-soft/50' : 'border-line hover:border-ink/30'}`}>
                  <input type="radio" name="who" value="new" checked={choice === 'new'} onChange={() => setChoice('new')} className="size-4 accent-teal" />
                  <UserPlus className="size-5 text-muted" aria-hidden />
                  <span className="font-semibold">Join as someone new</span>
                </label>
              </fieldset>
              {choice === 'new' && (
                <Field id="join-name" label="Your name" error={nameError}>
                  <input id="join-name" maxLength={40} value={name} onChange={(e) => { setName(e.target.value); setNameError(undefined); }}
                    className={inputCls(nameError)} aria-invalid={!!nameError} aria-describedby={describedBy('join-name', nameError)} />
                </Field>
              )}
              {formError && <p role="alert" className="rounded-xl bg-rust-soft px-3 py-2.5 text-sm font-semibold text-rust">{formError}</p>}
              <Button type="submit" size="lg" className="w-full" loading={busy}>Join household</Button>
            </form>
          )}
        </Card>
      )}
    </main>
  );
}
