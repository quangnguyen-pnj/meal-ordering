import { ScreenGuard } from '@/components/screen-guard';
import { TeamScreen } from '@/components/screens/team-screen';

export default function TeamPage() {
  return (
    <ScreenGuard href="/team">
      <TeamScreen />
    </ScreenGuard>
  );
}
