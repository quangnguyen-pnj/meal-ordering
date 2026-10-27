import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { usePagination } from '@/hooks/use-pagination';
import { Pagination, pageWindow } from './pagination';

describe('pageWindow', () => {
  it('shows every page of a short list', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it('keeps the first, last and neighbouring pages, with gaps between', () => {
    expect(pageWindow(1, 30)).toEqual([1, 2, 'gap', 30]);
    expect(pageWindow(15, 30)).toEqual([1, 'gap', 14, 15, 16, 'gap', 30]);
    expect(pageWindow(30, 30)).toEqual([1, 'gap', 29, 30]);
  });

  it('shows a single missing page instead of a gap', () => {
    expect(pageWindow(4, 30)).toEqual([1, 2, 3, 4, 5, 'gap', 30]);
  });
});

function Harness({ items, filter }: { items: number[]; filter: string }) {
  const { pageItems, pagination } = usePagination(items, filter);
  return (
    <>
      <p data-testid="rows">{pageItems.join(',')}</p>
      <Pagination {...pagination} />
    </>
  );
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('usePagination with Pagination', () => {
  it('pages through a list 25 rows at a time', async () => {
    render(<Harness items={range(60)} filter="" />);
    expect(screen.getByText('1–25 / 60')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Trang 3' }));
    expect(screen.getByTestId('rows')).toHaveTextContent(/^51,.*,60$/);
    expect(screen.getByRole('button', { name: 'Sau' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Trang 3' })).toHaveAttribute('aria-current', 'page');
  });

  it('goes back to page 1 when the filter changes, and hides for a single page', async () => {
    const { rerender } = render(<Harness items={range(60)} filter="" />);
    await userEvent.click(screen.getByRole('button', { name: 'Sau' }));
    expect(screen.getByText('26–50 / 60')).toBeInTheDocument();
    rerender(<Harness items={range(40)} filter="x" />);
    expect(screen.getByText('1–25 / 40')).toBeInTheDocument();
    rerender(<Harness items={range(10)} filter="y" />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByTestId('rows')).toHaveTextContent(/^1,.*,10$/);
  });

  it('stays on the last page that still exists when the list shrinks', async () => {
    const { rerender } = render(<Harness items={range(60)} filter="" />);
    await userEvent.click(screen.getByRole('button', { name: 'Trang 3' }));
    rerender(<Harness items={range(45)} filter="" />);
    expect(screen.getByText('26–45 / 45')).toBeInTheDocument();
  });
});
