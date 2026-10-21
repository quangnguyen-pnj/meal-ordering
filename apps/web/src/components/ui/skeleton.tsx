import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/messages';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn('h-4 w-4 animate-spin', className)} />;
}

/** Placeholder rows while a list loads; announced once to screen readers. */
export function LoadingRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" className={cn('flex flex-col gap-2', className)}>
      <span className="sr-only">{t('common.loading')}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
