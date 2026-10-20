import { ScreenGuard } from '@/components/screen-guard';
import { SettingsScreen } from '@/components/screens/settings-screen';

export default function SettingsPage() {
  return (
    <ScreenGuard href="/admin/settings">
      <SettingsScreen />
    </ScreenGuard>
  );
}
