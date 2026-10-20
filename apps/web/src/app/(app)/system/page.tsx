import { ScreenGuard } from '@/components/screen-guard';
import { SystemScreen } from '@/components/screens/system-screen';

export default function SystemPage() {
  return (
    <ScreenGuard href="/system">
      <SystemScreen />
    </ScreenGuard>
  );
}
