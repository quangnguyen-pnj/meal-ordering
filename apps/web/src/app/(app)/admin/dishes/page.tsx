import { ScreenGuard } from '@/components/screen-guard';
import { DishesScreen } from '@/components/screens/dishes-screen';

export default function DishesPage() {
  return (
    <ScreenGuard href="/admin/dishes">
      <DishesScreen />
    </ScreenGuard>
  );
}
