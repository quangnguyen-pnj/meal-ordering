import { ScreenGuard } from '@/components/screen-guard';
import { OrgScreen } from '@/components/screens/org-screen';

export default function OrgPage() {
  return (
    <ScreenGuard href="/admin/org">
      <OrgScreen />
    </ScreenGuard>
  );
}
