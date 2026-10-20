import { ScreenGuard } from '@/components/screen-guard';
import { EmployeesScreen } from '@/components/screens/employees-screen';
import { rolesCanSee } from '@/lib/nav';
import { getSession } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
  const user = await getSession();
  return (
    <ScreenGuard href="/admin/employees">
      <EmployeesScreen canManageOrg={user ? rolesCanSee(user.roles, 'org.manage') : false} />
    </ScreenGuard>
  );
}
