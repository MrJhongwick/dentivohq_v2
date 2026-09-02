import { cn } from '../lib/utils';

export function Skeleton({ className = '' }: { className?: string }) { return <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} />; }
export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="flex flex-col items-center gap-2 py-12 text-center"><h3 className="font-semibold">{title}</h3><p className="max-w-md text-sm text-muted-foreground">{description}</p></div>;
}
