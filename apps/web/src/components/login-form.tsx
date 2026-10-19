'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PinLoginSchema, type PinLoginInput, type SessionUser } from '@meal/shared';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api';
import { formatVnTime, safeNextPath } from '@/lib/utils';
import { errorMessage, t } from '@/messages';

export function loginErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return t('network');
    if (error.code === 'PIN_LOCKED' && error.lockedUntil) {
      return t('login.lockedUntil', { time: formatVnTime(error.lockedUntil) });
    }
    return errorMessage(error.code);
  }
  return errorMessage('INTERNAL');
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const ssoFailed = params.get('error') === 'sso_failed';

  const form = useForm<PinLoginInput>({
    resolver: zodResolver(PinLoginSchema),
    defaultValues: { employeeCode: '', pin: '' },
  });

  const login = useMutation({
    mutationFn: (input: PinLoginInput) =>
      api.post<{ user: SessionUser | null }>('/auth/pin/login', input),
    onSuccess: ({ user }) => {
      router.replace(user?.pinMustChange ? '/change-pin' : safeNextPath(params.get('next')));
      router.refresh();
    },
    onError: () => form.resetField('pin'),
  });

  const pinError = form.formState.errors.pin;
  const codeError = form.formState.errors.employeeCode;

  return (
    <div className="flex flex-col gap-5">
      {ssoFailed ? <Alert variant="error">{t('login.ssoFailed')}</Alert> : null}

      <Button asChild variant="outline" className="w-full">
        {/* Full navigation, not client routing: the API answers with a redirect to Microsoft. */}
        <a href="/api/auth/entra/login">{t('login.microsoft')}</a>
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        {t('login.or')}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form
        noValidate
        onSubmit={form.handleSubmit((values) => login.mutate(values))}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="employeeCode">{t('login.employeeCode')}</Label>
          <Input
            id="employeeCode"
            autoComplete="username"
            autoCapitalize="characters"
            placeholder={t('login.employeeCodePlaceholder')}
            aria-invalid={codeError ? true : undefined}
            {...form.register('employeeCode')}
          />
          {codeError ? (
            <p role="alert" className="text-sm text-destructive">
              {t('common.requiredField')}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="pin">{t('login.pin')}</Label>
          <Input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={6}
            aria-invalid={pinError ? true : undefined}
            {...form.register('pin')}
          />
          {pinError ? (
            <p role="alert" className="text-sm text-destructive">
              {t('login.pinFormat')}
            </p>
          ) : null}
        </div>

        {login.isError ? (
          <Alert variant="error" role="alert">
            {loginErrorText(login.error)}
          </Alert>
        ) : null}

        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? t('login.submitting') : t('login.submit')}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">{t('login.help')}</p>
    </div>
  );
}
