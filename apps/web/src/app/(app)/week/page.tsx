import { ScreenGuard } from '@/components/screen-guard';
import { WeekMenuScreen } from '@/components/screens/week-menu-screen';

export default function WeekPage() {
  return (
    <ScreenGuard href="/week">
      <WeekMenuScreen />
    </ScreenGuard>
  );
}
