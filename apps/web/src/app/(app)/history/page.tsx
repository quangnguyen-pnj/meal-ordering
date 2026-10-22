import { ScreenGuard } from '@/components/screen-guard';
import { HistoryScreen } from '@/components/screens/history-screen';

export default function HistoryPage() {
  return (
    <ScreenGuard href="/history">
      <HistoryScreen />
    </ScreenGuard>
  );
}
