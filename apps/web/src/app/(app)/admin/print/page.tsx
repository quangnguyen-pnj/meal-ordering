import { ScreenGuard } from '@/components/screen-guard';
import { PrintScreen } from '@/components/screens/print-screen';

export default function PrintPage() {
  return (
    <ScreenGuard href="/admin/print">
      <PrintScreen />
    </ScreenGuard>
  );
}
