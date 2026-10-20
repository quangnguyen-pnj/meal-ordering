import { z } from 'zod';

export const SettingUpdateSchema = z.object({ value: z.unknown() });

export interface SettingView {
  key: string;
  value: unknown;
  defaultValue: unknown;
  updatedAt: string | null;
}

export interface BannerView {
  id: string;
  severity: 'info' | 'warning' | 'error';
  /** Message key in the web messages file plus its parameters. */
  kind: 'MENU_NOT_PUBLISHED' | 'NOTIFICATION';
  params: Record<string, string | number>;
  /** For NOTIFICATION banners: the notification to mark read. */
  notificationId?: string;
  notificationType?: string;
}
