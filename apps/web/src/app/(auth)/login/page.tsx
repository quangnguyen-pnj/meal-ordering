import { Suspense } from 'react';
import { LoginForm } from '@/components/login-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/messages';

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('login.title')}</CardTitle>
        <CardDescription>{t('login.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<p>{t('common.loading')}</p>}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
