import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { formatRange, formatWeekRange } from '@/lib/utils';
import { shortOrgPath } from '../screens/employees-screen';
import { useConfirm } from './dialog';
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

describe('confirm dialog', () => {
  it('resolves true on confirm and false on Escape, and returns focus to the opener', async () => {
    render(<ConfirmHarness />);
    const opener = screen.getByRole('button', { name: 'open' });

    await userEvent.click(opener);
    expect(screen.getByRole('dialog', { name: 'Công bố thực đơn?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Công bố' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Công bố' }));
    expect(screen.getByTestId('answer')).toHaveTextContent('true');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();

    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('answer')).toHaveTextContent('false');
    expect(screen.queryByRole('dialog')).toBeNull();
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
