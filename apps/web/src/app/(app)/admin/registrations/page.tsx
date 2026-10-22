import { ScreenGuard } from '@/components/screen-guard';
import { RegistrationsAdminScreen } from '@/components/screens/registrations-admin-screen';

export default function RegistrationsAdminPage() {
  return (
    <ScreenGuard href="/admin/registrations">
      <RegistrationsAdminScreen />
    </ScreenGuard>
  );
}
