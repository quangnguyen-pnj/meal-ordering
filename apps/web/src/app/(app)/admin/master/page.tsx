import { ScreenGuard } from '@/components/screen-guard';
import { MasterScreen } from '@/components/screens/master-screen';

export default function MasterPage() {
  return (
    <ScreenGuard href="/admin/master">
      <MasterScreen />
    </ScreenGuard>
  );
}
