import { ScreenGuard } from '@/components/screen-guard';
import { MenuScreen } from '@/components/screens/menu-screen';

export default function MenuPage() {
  return (
    <ScreenGuard href="/admin/menu">
      <MenuScreen />
    </ScreenGuard>
  );
}
