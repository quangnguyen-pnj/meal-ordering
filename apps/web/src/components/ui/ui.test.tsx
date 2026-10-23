import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatRange, formatWeekNumber, formatWeekRange } from '@/lib/utils';
import { shortOrgPath } from '../screens/employees-screen';
import { useConfirm } from '@/components/confirm-dialog';
import { ResponsiveSelect } from '@/components/responsive-select';
import { normalizeTime } from './time-input';

function ConfirmHarness() {
  const [confirm, element] = useConfirm();
  const [answer, setAnswer] = useState('none');
  return (
    <>
      <button
        onClick={async () =>
          setAnswer(String(await confirm({ title: 'Công bố thực đơn?', confirmLabel: 'Công bố' })))
        }
      >
        open
      </button>
      <p data-testid="answer">{answer}</p>
      {element}
    </>
  );
}

describe('confirm dialog (shadcn/ui AlertDialog)', () => {
  it('resolves true on confirm and false on Escape, and returns focus to the opener', async () => {
    render(<ConfirmHarness />);
    const opener = screen.getByRole('button', { name: 'open' });

    await userEvent.click(opener);
    expect(screen.getByRole('alertdialog', { name: 'Công bố thực đơn?' })).toBeInTheDocument();
    // AlertDialog puts the focus on the safe choice first.
    expect(screen.getByRole('button', { name: 'Hủy' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Công bố' }));
    expect(screen.getByTestId('answer')).toHaveTextContent('true');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(opener).toHaveFocus();

    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('answer')).toHaveTextContent('false');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('ResponsiveSelect', () => {
  const options = [
    { value: '', label: 'Tất cả' },
    { value: 'T2', label: 'Tầng 2' },
  ];
  afterEach(() => vi.unstubAllGlobals());

  it('uses the shadcn/ui Select with a mouse, keeping "" as a real option', () => {
    render(
      <ResponsiveSelect aria-label="Tầng" value="" onValueChange={() => {}} options={options} />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Tầng' });
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveTextContent('Tất cả');
  });

  it("uses the operating system's picker on a touch screen", async () => {
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: query === '(pointer: coarse)',
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    let picked = 'none';
    render(
      <ResponsiveSelect
        aria-label="Tầng"
        value=""
        onValueChange={(v) => (picked = v)}
        options={options}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Tầng' });
    expect(select.tagName).toBe('SELECT');
    await userEvent.selectOptions(select, 'T2');
    expect(picked).toBe('T2');
  });
});

describe('display helpers', () => {
  it('reads typed times as 24-hour HH:mm', () => {
    expect(normalizeTime('830')).toBe('08:30');
    expect(normalizeTime('0830')).toBe('08:30');
    expect(normalizeTime('8:30')).toBe('08:30');
    expect(normalizeTime('23:59')).toBe('23:59');
    expect(normalizeTime('8h')).toBe('8h');
  });

  it('shows a week as its Monday to Sunday range', () => {
    expect(formatWeekRange('2026-10-26')).toBe('26/10 – 01/11/2026');
    expect(formatWeekRange('2026-12-28')).toBe('28/12 – 03/01/2027');
    expect(formatWeekNumber('2026-10-26')).toBe('Tuần 44');
    expect(formatWeekNumber('2026-12-28')).toBe('Tuần 53');
  });

  it('shows which page of a list is on screen', () => {
    expect(formatRange(0, 50, 1700)).toBe('1–50 / 1.700');
    expect(formatRange(1650, 50, 1700)).toBe('1.651–1.700 / 1.700');
    expect(formatRange(0, 0, 0)).toBe('0');
  });

  it('keeps the last two levels of a long org path', () => {
    expect(shortOrgPath('Khối Sản xuất / Xưởng Chế tác / Chuyền A / Tổ Nhẫn')).toBe(
      '… / Chuyền A / Tổ Nhẫn',
    );
    expect(shortOrgPath('Khối Văn phòng / Phòng IT')).toBe('Khối Văn phòng / Phòng IT');
  });
});
