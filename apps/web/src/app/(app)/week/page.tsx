import { ScreenGuard } from '@/components/screen-guard';
import { WeekRegistrationScreen } from '@/components/screens/week-registration-screen';

export default function WeekPage() {
  return (
    <ScreenGuard href="/week">
      <WeekRegistrationScreen />
    </ScreenGuard>
  );
}
