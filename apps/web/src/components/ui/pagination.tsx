'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn, formatRange } from '@/lib/utils';
import { t } from '@/messages';

/** Rows per page for every list, so phones never get a page tens of thousands of pixels long. */
export const PAGE_SIZE = 25;

export interface PaginationProps {
  /** 1-based. */
  page: number;
  pageCount: number;
  /** Index of the page's first row in the whole list. */
  offset: number;
  /** Rows on this page. */
  count: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Page buttons to show: first, last and the current page's neighbours, with gaps between. */
export function pageWindow(page: number, pageCount: number): Array<number | 'gap'> {
  const shown = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  for (const p of shown) {
    const prev = out[out.length - 1];
    // A gap of one page shows that page instead of "…".
    if (typeof prev === 'number' && p - prev === 2) out.push(prev + 1);
    else if (typeof prev === 'number' && p - prev > 2) out.push('gap');
    out.push(p);
  }
  return out;
}

/**
 * shadcn/ui-style pagination under a list: "1–25 / 746", previous / next, and page numbers from
 * `sm` up ("Trang 2/30" on phones). Renders nothing for a single page. Changing page scrolls the
 * list back into view when its top has gone above the screen.
 */
export function Pagination({
  page,
  pageCount,
  offset,
  count,
  total,
  onPageChange,
  className,
}: PaginationProps) {
  const ref = useRef<HTMLElement>(null);
  if (pageCount <= 1) return null;

  function go(next: number) {
    onPageChange(next);
    const list = ref.current?.parentElement;
    const top = list?.getBoundingClientRect().top ?? 0;
    // 72px clears the sticky header on phones.
    if (top < 0) window.scrollBy({ top: top - 72, behavior: 'smooth' });
  }

  return (
    <nav
      ref={ref}
      aria-label={t('pagination.label')}
      className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2', className)}
    >
      <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
        {formatRange(offset, count, total)}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-11 sm:h-9"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t('common.previous')}
        </Button>
        <span className="px-2 text-sm tabular-nums sm:hidden">
          {t('pagination.pageOf', { page, pageCount })}
        </span>
        <ul className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, pageCount).map((p, i) =>
            p === 'gap' ? (
              <li key={`gap-${i}`} aria-hidden className="w-6 text-center text-muted-foreground">
                …
              </li>
            ) : (
              <li key={p}>
                <Button
                  variant={p === page ? 'outline' : 'ghost'}
                  size="sm"
                  className={cn('min-w-9 px-2 tabular-nums', p === page && 'font-semibold')}
                  aria-current={p === page ? 'page' : undefined}
                  aria-label={t('pagination.page', { page: p })}
                  onClick={() => p !== page && go(p)}
                >
                  {p}
                </Button>
              </li>
            ),
          )}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="h-11 sm:h-9"
          disabled={page >= pageCount}
          onClick={() => go(page + 1)}
        >
          {t('common.next')}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
