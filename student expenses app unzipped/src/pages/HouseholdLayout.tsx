import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { ArrowLeftRight, ChevronLeft, History, LayoutDashboard, Plus, ShieldOff, Users } from 'lucide-react';
import { api, ApiError, errMsg } from '../lib/api';
import { computeBalances } from '../lib/money';
import type { HouseholdData, Member } from '../lib/types';
import { HouseholdContext, type HouseholdCtx } from '../contexts/HouseholdContext';
import { Avatar, EmptyState, ErrorBanner, Logo, Skeleton } from '../components/ui';

export default function HouseholdLayout() {
  const { householdId = '' } = useParams();
  const location = useLocation();
  const [data, setData] = useState<HouseholdData | null>(null);
  const [error, setError] = useState<{ msg: string; status: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const d = await api<HouseholdData>(`/api/household?id=${encodeURIComponent(householdId)}`);
      setData(d);
      setError(null);
    } catch (e) {
      setError({ msg: errMsg(e), status: e instanceof ApiError ? e.status : 0 });
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    refresh();
  }, [refresh]);

  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  const ctx = useMemo<HouseholdCtx | null>(() => {
    if (!data) return null;
    const memberById: Record<string, Member> = {};
    for (const m of data.members) memberById[m.id] = m;
    return {
      ...data,
      memberById,
      balances: computeBalances(data.members, data.expenses, data.payments),
      label: (id: string) => (id === data.me.id ? 'You' : memberById[id]?.display_name ?? 'Former member'),
      refresh,
    };
  }, [data, refresh]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-6" role="status" aria-label="Loading household">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    );
  }

  if (!ctx) {
    const forbidden = error?.status === 403 || error?.status === 400 || error?.status === 404;
    return (
      <main className="mx-auto max-w-md px-4 pt-16">
        {forbidden ? (
          <EmptyState
            icon={<ShieldOff className="size-6" aria-hidden />}
            title="No access to this household"
            body="Household data is private to its members. Ask someone in the household for an invite link."
            action={<Link to="/" className="inline-flex h-11 items-center rounded-xl bg-ink px-4 font-semibold text-card">My households</Link>}
          />
        ) : (
          <ErrorBanner title="Couldn’t load this household" message={error?.msg ?? 'Unknown error'} onRetry={() => { setLoading(true); refresh(); }} />
        )}
      </main>
    );
  }

  const base = `/h/${householdId}`;
  return (
    <HouseholdContext.Provider value={ctx}>
      <div className="min-h-dvh">
        <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-2xl items-center gap-2 px-3">
            <Link to="/" aria-label="All households" className="grid size-10 place-items-center rounded-xl text-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-teal">
              <ChevronLeft className="size-5" aria-hidden />
            </Link>
            <Logo className="size-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg leading-tight font-semibold">{ctx.household.name}</p>
              <p className="text-xs text-muted">{ctx.members.length} {ctx.members.length === 1 ? 'member' : 'members'}</p>
            </div>
            <Link to={`${base}/members`} className="flex -space-x-2 rounded-full p-1 focus-visible:outline-2 focus-visible:outline-teal" aria-label="View members">
              {ctx.members.slice(0, 4).map((m) => (
                <span key={m.id} className="rounded-full ring-2 ring-paper"><Avatar id={m.id} name={m.display_name} size="sm" placeholder={!m.user_id} /></span>
              ))}
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 pb-36 pt-5">
          <Outlet />
        </main>

        <nav aria-label="Household" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
          <ul className="mx-auto grid h-[68px] max-w-2xl grid-cols-5 items-center px-1">
            <Tab to={base} end icon={<LayoutDashboard className="size-5" aria-hidden />} label="Balances" />
            <Tab to={`${base}/activity`} icon={<History className="size-5" aria-hidden />} label="History" />
            <li className="flex justify-center">
              <NavLink to={`${base}/expenses/new`} aria-label="Add expense"
                className={({ isActive }) => `-mt-7 grid size-14 place-items-center rounded-2xl shadow-lg shadow-ink/20 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 ${isActive ? 'bg-teal text-white' : 'bg-ink text-card'}`}>
                <Plus className="size-7" aria-hidden />
              </NavLink>
            </li>
            <Tab to={`${base}/settle`} icon={<ArrowLeftRight className="size-5" aria-hidden />} label="Settle up" />
            <Tab to={`${base}/members`} icon={<Users className="size-5" aria-hidden />} label="Members" />
          </ul>
        </nav>
      </div>
    </HouseholdContext.Provider>
  );
}

function Tab({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <li>
      <NavLink to={to} end={end}
        className={({ isActive }) => `mx-auto flex h-14 w-full max-w-24 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${isActive ? 'text-teal' : 'text-muted hover:text-ink'}`}>
        {({ isActive }) => (
          <>
            <span className={`grid h-7 w-12 place-items-center rounded-full transition ${isActive ? 'bg-teal-soft' : ''}`}>{icon}</span>
            {label}
          </>
        )}
      </NavLink>
    </li>
  );
}
