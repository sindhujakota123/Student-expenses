import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, Loader2, RotateCw } from 'lucide-react';

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-ink text-card hover:bg-ink/90 shadow-sm',
  accent: 'bg-teal text-white hover:bg-teal/90 shadow-sm',
  outline: 'border border-line bg-card text-ink hover:border-ink/30',
  ghost: 'text-ink hover:bg-ink/5',
  danger: 'bg-rust text-white hover:bg-rust/90',
};
const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-[15px]', lg: 'h-13 px-5 text-base' };

export function Button({
  variant = 'primary', size = 'md', loading, className = '', children, disabled, type, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes; loading?: boolean }) {
  return (
    <button
      {...rest}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({
  id, label, error, hint, optional, children,
}: { id: string; label: ReactNode; error?: string; hint?: ReactNode; optional?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold text-ink">
        {label}
        {optional && <span className="font-medium text-muted"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm font-semibold text-rust">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputCls = (err?: unknown) =>
  `w-full h-12 rounded-xl border bg-card px-3.5 text-[16px] text-ink placeholder:text-muted/60 transition focus:outline-none focus:ring-2 ${
    err ? 'border-rust focus:ring-rust/25' : 'border-line focus:border-teal focus:ring-teal/25'
  }`;

export const describedBy = (id: string, error?: string, hint?: unknown) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-teal ${className}`} aria-hidden />;
}

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted">
      <Spinner className="size-7" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function ErrorBanner({ message, onRetry, title = 'Something went wrong' }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rust/30 bg-rust-soft p-4 text-ink">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rust" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        <p className="text-sm text-ink/80">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCw className="size-3.5" aria-hidden /> Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-line bg-card/60 px-6 py-10 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-mustard-soft text-ink">{icon}</div>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-card p-5 shadow-[0_1px_0_rgba(30,42,43,0.04)] ${className}`}>{children}</section>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-lg font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-line/60 ${className}`} aria-hidden />;
}

const palette = ['#0E6B62', '#A63D24', '#9A7419', '#3F5A8A', '#7A4E8C', '#4F7A3A', '#A84B6E', '#2F6F8F'];
export function colorFor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function Avatar({ name, id, size = 'md', placeholder }: { name: string; id: string; size?: 'sm' | 'md' | 'lg'; placeholder?: boolean }) {
  const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const s = size === 'sm' ? 'size-7 text-[11px]' : size === 'lg' ? 'size-12 text-base' : 'size-9 text-xs';
  const color = colorFor(id);
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full font-extrabold ${s} ${placeholder ? 'border-2 border-dashed bg-card' : 'text-white'}`}
      style={placeholder ? { borderColor: color, color } : { backgroundColor: color }}
    >
      {initials || '?'}
    </span>
  );
}

export function ConfirmDialog({
  open, title, body, confirmLabel = 'Confirm', busy, error, onConfirm, onClose,
}: {
  open: boolean; title: string; body: ReactNode; confirmLabel?: string; busy?: boolean; error?: string | null;
  onConfirm: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(92vw,420px)] rounded-3xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-ink/45 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="font-display text-xl font-semibold">{title}</h2>
        <div className="mt-2 text-sm text-muted">{body}</div>
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-rust">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  );
}

export function Logo({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="11" fill="#1E2A2B" />
      <path d="M11 9h11v22l-2.2-1.6-2.2 1.6-2.2-1.6-2.2 1.6L11 29.4z" fill="#F5EFE3" />
      <path d="M24.5 9H29v20.4l-2.2 1.6-2.3-1.6z" fill="#3FB8A6" />
      <path d="M14 15h5M14 19h5M14 23h3" stroke="#1E2A2B" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
