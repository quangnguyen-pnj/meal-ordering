'use client';

import {
  SETTING_DEFINITIONS,
  type SettingKey,
  type SettingView,
  type WeekdayTime,
} from '@meal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { apiErrorText } from '@/lib/errors';
import { t, vi } from '@/messages';

type Editor = 'weekdayTime' | 'time' | 'number' | 'days';

const EDITOR: Record<SettingKey, Editor> = {
  'registration.close': 'weekdayTime',
  'registration.latePublishHours': 'number',
  'menu.publishWarnAt': 'weekdayTime',
  servingDays: 'days',
  'day.lockTime': 'time',
  'attendance.pollStart': 'time',
  'attendance.pollIntervalMin': 'number',
  'attendance.cutoff': 'time',
  'attendance.safetyMinPresentPct': 'number',
  'reconciliation.dishDeviationPct': 'number',
  'close.time': 'time',
  'close.reminderAt': 'time',
  'close.adjustmentDeadline': 'time',
  'delivery.tolerancePct': 'number',
  'delivery.confirmDeadline': 'time',
  'pin.maxAttempts': 'number',
  'pin.lockMinutes': 'number',
};

const GROUPS: Array<{ key: keyof typeof vi.settings.groups; keys: SettingKey[] }> = [
  {
    key: 'registration',
    keys: ['registration.close', 'registration.latePublishHours', 'menu.publishWarnAt'],
  },
  { key: 'day', keys: ['servingDays', 'day.lockTime'] },
  {
    key: 'attendance',
    keys: [
      'attendance.pollStart',
      'attendance.pollIntervalMin',
      'attendance.cutoff',
      'attendance.safetyMinPresentPct',
    ],
  },
  {
    key: 'close',
    keys: [
      'reconciliation.dishDeviationPct',
      'close.time',
      'close.reminderAt',
      'close.adjustmentDeadline',
      'delivery.tolerancePct',
      'delivery.confirmDeadline',
    ],
  },
  { key: 'pin', keys: ['pin.maxAttempts', 'pin.lockMinutes'] },
];

const weekdayName = (n: number) => vi.weekdays[n as keyof typeof vi.weekdays];

export function describeSetting(key: SettingKey, value: unknown): string {
  switch (EDITOR[key]) {
    case 'weekdayTime': {
      const v = value as WeekdayTime;
      return t('settings.weekdayTime', { weekday: weekdayName(v.weekday), time: v.time });
    }
    case 'days':
      return (value as number[]).map(weekdayName).join(', ');
    default:
      return String(value);
  }
}

/** /admin/settings: plan 6.4 keys plus the caterer and unit price (plan section 3). */
export function SettingsScreen() {
  const list = useQuery({
    queryKey: ['/admin/settings'],
    queryFn: () => api.get<{ items: SettingView[] }>('/admin/settings'),
  });
  if (list.error) return <Alert variant="error">{apiErrorText(list.error)}</Alert>;
  const byKey = new Map((list.data?.items ?? []).map((s) => [s.key as SettingKey, s]));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.title')}</CardTitle>
          <CardDescription>{t('settings.intro')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {GROUPS.map((group) => (
            <section key={group.key} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {vi.settings.groups[group.key]}
              </h2>
              {group.keys.map((key) => {
                const setting = byKey.get(key);
                return setting ? <SettingRow key={key} settingKey={key} setting={setting} /> : null;
              })}
            </section>
          ))}
        </CardContent>
      </Card>
      <SupplierCard />
    </div>
  );
}

function SettingRow({ settingKey, setting }: { settingKey: SettingKey; setting: SettingView }) {
  const qc = useQueryClient();
  const [value, setValue] = useState<unknown>(setting.value);
  const [saved, setSaved] = useState(false);
  const editor = EDITOR[settingKey];
  const valid = SETTING_DEFINITIONS[settingKey].schema.safeParse(value).success;
  const changed = JSON.stringify(value) !== JSON.stringify(setting.value);

  const save = useMutation({
    mutationFn: () => api.put<SettingView>(`/admin/settings/${settingKey}`, { value }),
    onSuccess: () => {
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ['/admin/settings'] });
    },
  });
  const id = `setting-${settingKey}`;

  return (
    <form
      className="grid items-end gap-3 rounded-md border p-3 md:grid-cols-[1fr_auto_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        save.mutate();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>{vi.settings.keys[settingKey]}</Label>
        {editor === 'number' ? (
          <Input
            id={id}
            type="number"
            className="max-w-40"
            value={String(value)}
            onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))}
          />
        ) : editor === 'time' ? (
          <Input
            id={id}
            type="time"
            className="max-w-40"
            value={String(value)}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : editor === 'weekdayTime' ? (
          <div className="flex gap-2">
            <Select
              id={id}
              className="max-w-40"
              value={(value as WeekdayTime).weekday}
              onChange={(e) =>
                setValue({ ...(value as WeekdayTime), weekday: Number(e.target.value) })
              }
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {weekdayName(d)}
                </option>
              ))}
            </Select>
            <Input
              type="time"
              aria-label={vi.settings.keys[settingKey]}
              className="max-w-36"
              value={(value as WeekdayTime).time}
              onChange={(e) => setValue({ ...(value as WeekdayTime), time: e.target.value })}
            />
          </div>
        ) : (
          <div id={id} className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <label key={d} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={(value as number[]).includes(d)}
                  onChange={(e) => {
                    const days = new Set(value as number[]);
                    if (e.target.checked) days.add(d);
                    else days.delete(d);
                    setValue([...days].sort());
                  }}
                />
                {weekdayName(d)}
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {t('settings.default', { value: describeSetting(settingKey, setting.defaultValue) })}
        </p>
        {save.error ? <p className="text-sm text-destructive">{apiErrorText(save.error)}</p> : null}
        {!valid ? (
          <p className="text-sm text-destructive">{t('errors.VALIDATION_FAILED')}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={!changed || !valid || save.isPending}>
        {save.isPending ? t('common.saving') : t('common.save')}
      </Button>
      <span className="min-w-16 text-sm text-muted-foreground" role="status">
        {saved && !changed ? t('common.saved') : ''}
      </span>
    </form>
  );
}

function SupplierCard() {
  const qc = useQueryClient();
  const supplier = useQuery({
    queryKey: ['/admin/supplier'],
    queryFn: () => api.get<{ id: string; name: string; unitPrice: number }>('/admin/supplier'),
  });
  const [draft, setDraft] = useState<{ name: string; unitPrice: string } | null>(null);
  const save = useMutation({
    mutationFn: (d: { name: string; unitPrice: string }) =>
      api.put('/admin/supplier', { name: d.name, unitPrice: Number(d.unitPrice) }),
    onSuccess: () => {
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ['/admin/supplier'] });
    },
  });
  const current =
    draft ??
    (supplier.data
      ? { name: supplier.data.name, unitPrice: String(supplier.data.unitPrice) }
      : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('settings.supplierTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {current ? (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(current);
            }}
          >
            <div className="flex min-w-72 flex-1 flex-col gap-2">
              <Label htmlFor="supplier-name">{t('settings.supplierName')}</Label>
              <Input
                id="supplier-name"
                required
                value={current.name}
                onChange={(e) => setDraft({ ...current, name: e.target.value })}
              />
            </div>
            <div className="flex w-48 flex-col gap-2">
              <Label htmlFor="supplier-price">{t('settings.unitPrice')}</Label>
              <Input
                id="supplier-price"
                type="number"
                min={0}
                step={500}
                required
                value={current.unitPrice}
                onChange={(e) => setDraft({ ...current, unitPrice: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={!draft || save.isPending}>
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </form>
        ) : null}
        {(save.error ?? supplier.error) ? (
          <Alert variant="error" className="mt-3">
            {apiErrorText(save.error ?? supplier.error)}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
