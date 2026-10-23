import { ScreenGuard } from '@/components/screen-guard';
import { TodayScreen } from '@/components/screens/today-screen';

export default function TodayPage() {
  return (
    <ScreenGuard href="/today">
      <TodayScreen />
    </ScreenGuard>
  );
}
