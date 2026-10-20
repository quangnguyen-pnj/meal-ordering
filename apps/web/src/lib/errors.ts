import { ApiError } from '@/lib/api';
import { errorMessage, t } from '@/messages';

/** Vietnamese text for any failed call (plan 7.1 rule 9: copy lives in the messages file). */
export function apiErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status === 0 ? t('network') : errorMessage(error.code);
  }
  return errorMessage('INTERNAL');
}
