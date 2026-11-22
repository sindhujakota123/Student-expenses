import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MailCheck, Sparkles } from 'lucide-react';
import supabase from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import { useAuth } from '../contexts/AuthContext';
import { Button, Field, Logo, describedBy, inputCls } from '../components/ui';

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'That doesn’t look like a valid email.';
    if (!password) e.password = 'Enter your password.';
    else if (mode === 'signup' && password.length < 8) e.password = 'Use at least 8 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setErrors({ form: error.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : error.message });
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) setErrors({ form: error.message });
        else if (!data.session) setCheckEmail(true);
      }
    } catch {
      setErrors({ form: 'Couldn’t reach the server. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  };

  const google = () => {
    if (!signInWithGoogle('Student Expenses')) setErrors({ form: 'Google sign-in isn’t configured for this deployment. Use email instead.' });
  };

  const useDemo = () => {
    setMode('signin');
    setEmail('demo@billsplitter.app');
    setPassword('password123');
    setErrors({});
  };

  return (
    <main className="mx-auto grid min-h-dvh max-w-5xl items-center gap-10 px-5 py-10 md:grid-cols-[1.1fr_1fr]">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="hidden md:block">
        <div className="flex items-center gap-3">
          <Logo className="size-11" />
          <span className="font-display text-2xl font-semibold">Student Expenses</span>
        </div>
        <h1 className="mt-10 font-display text-5xl leading-[1.05] font-semibold tracking-tight">
          Shared home,<br />
          <span className="italic text-teal">square</span> accounts.
        </h1>
        <p className="mt-5 max-w-md text-lg text-muted">
          Log rent, groceries and the internet bill as they happen. Everyone sees who owes what — and the fewest payments to settle up.
        </p>
        <ul className="mt-8 space-y-3 text-[15px]">
          {['Split equally or by exact amounts', 'Private to the people in your household', 'Record payback in one tap'].map((t) => (
            <li key={t} className="flex items-center gap-3">
              <span className="grid size-6 place-items-center rounded-full bg-teal-soft text-teal">✓</span>
              {t}
            </li>
          ))}
        </ul>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="w-full">
        <div className="mb-8 flex items-center gap-3 md:hidden">
          <Logo className="size-10" />
          <span className="font-display text-2xl font-semibold">Student Expenses</span>
        </div>
        <div className="rounded-3xl border border-line bg-card p-6 shadow-xl shadow-ink/5 sm:p-8">
          {checkEmail ? (
            <div className="text-center" role="status">
              <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-teal-soft text-teal"><MailCheck className="size-7" aria-hidden /></div>
              <h2 className="font-display text-2xl font-semibold">Check your inbox</h2>
              <p className="mt-2 text-sm text-muted">We sent a confirmation link to <strong className="text-ink">{email}</strong>. Open it, then come back and sign in.</p>
              <Button variant="outline" className="mt-6" onClick={() => { setCheckEmail(false); setMode('signin'); }}>Back to sign in</Button>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl font-semibold">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
              <p className="mt-1 text-sm text-muted">{mode === 'signin' ? 'Sign in to see your household balances.' : 'Start a household and invite your roommates.'}</p>

              <Button variant="outline" className="mt-6 w-full" onClick={google}>
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
                Continue with Google
              </Button>

              <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted">
                <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
              </div>

              <form onSubmit={submit} noValidate className="space-y-4">
                <Field id="email" label="Email" error={errors.email}>
                  <input id="email" type="email" autoComplete="email" inputMode="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} className={inputCls(errors.email)}
                    aria-invalid={!!errors.email} aria-describedby={describedBy('email', errors.email)} placeholder="you@example.com" />
                </Field>
                <Field id="password" label="Password" error={errors.password} hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
                  <input id="password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password}
                    onChange={(e) => setPassword(e.target.value)} className={inputCls(errors.password)}
                    aria-invalid={!!errors.password} aria-describedby={describedBy('password', errors.password, mode === 'signup')} />
                </Field>
                {errors.form && <p role="alert" className="rounded-xl bg-rust-soft px-3 py-2.5 text-sm font-semibold text-rust">{errors.form}</p>}
                <Button type="submit" className="w-full" size="lg" loading={busy}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Button>
              </form>

              <p className="mt-5 text-center text-sm text-muted">
                {mode === 'signin' ? 'New here?' : 'Already have an account?'}{' '}
                <button type="button" className="font-bold text-teal underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-teal"
                  onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErrors({}); }}>
                  {mode === 'signin' ? 'Create an account' : 'Sign in'}
                </button>
              </p>
            </>
          )}
        </div>
        {!checkEmail && (
          <button type="button" onClick={useDemo}
            className="mx-auto mt-4 flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-teal">
            <Sparkles className="size-4 text-mustard" aria-hidden /> Fill in the demo account
          </button>
        )}
      </motion.div>
    </main>
  );
}
