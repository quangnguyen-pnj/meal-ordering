import { redirect } from 'next/navigation';
import { ChangePinForm } from '@/components/change-pin-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSession } from '@/lib/server-api';
import { t } from '@/messages';

export const dynamic = 'force-dynamic';

export default async function ChangePinPage() {
  const user = await getSession();
  if (!user) redirect('/login?next=/change-pin');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('changePin.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChangePinForm forced={user.pinMustChange} />
      </CardContent>
    </Card>
  );
}
