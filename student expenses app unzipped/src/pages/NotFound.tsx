import { Link } from 'react-router-dom';
import { MapPinOff } from 'lucide-react';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4">
      <EmptyState
        icon={<MapPinOff className="size-6" aria-hidden />}
        title="Page not found"
        body="The page you're looking for doesn't exist or has moved."
        action={<Link to="/" className="inline-flex h-11 items-center rounded-xl bg-ink px-4 font-semibold text-card">Go to my households</Link>}
      />
    </main>
  );
}
