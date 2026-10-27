import { useState } from 'react';
import { PAGE_SIZE, type PaginationProps } from '@/components/ui/pagination';

/**
 * Client-side paging for a list the API returns whole (a factory has about 1,700 employees, so
 * these lists stay small enough to fetch at once). Back to page 1 whenever `resetKey` changes,
 * e.g. a search or filter; the page is clamped when the list shrinks.
 */
export function usePagination<T>(items: readonly T[], resetKey = '', pageSize = PAGE_SIZE) {
  const [state, setState] = useState({ page: 1, key: resetKey });
  if (state.key !== resetKey) setState({ page: 1, key: resetKey });
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = state.key === resetKey ? Math.min(state.page, pageCount) : 1;
  const offset = (page - 1) * pageSize;
  const pageItems = items.slice(offset, offset + pageSize);
  const pagination: PaginationProps = {
    page,
    pageCount,
    offset,
    count: pageItems.length,
    total: items.length,
    onPageChange: (next) => setState({ page: next, key: resetKey }),
  };
  return { pageItems, pagination };
}
