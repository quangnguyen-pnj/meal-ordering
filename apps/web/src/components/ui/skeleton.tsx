import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/messages';

// shadcn/ui Skeleton, plus a spinner and a list placeholder built on it.
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
  );
}

function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn('h-4 w-4 animate-spin', className)} />;
}

/** Placeholder rows while a list loads; announced once to screen readers. */
function LoadingRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" className={cn('flex flex-col gap-2', className)}>
      <span className="sr-only">{t('common.loading')}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export { LoadingRows, Skeleton, Spinner };
