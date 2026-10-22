'use client';

import { useCallback, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { t } from '@/messages';

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Where focus goes afterwards; defaults to whatever had focus when confirm() was called. */
  returnFocusTo?: HTMLElement | null;
}

/**
 * Radix only gives focus back to a Dialog.Trigger. Dialogs opened from code (a row menu, a
 * button handler) pass the element to return to; a detached element falls back to Radix.
 */
export function returnFocus(event: Event, target: HTMLElement | null | undefined) {
  if (target?.isConnected) {
    event.preventDefault();
    target.focus();
  }
}

/**
 * Promise-based replacement for window.confirm on the shadcn/ui AlertDialog:
 * `if (await confirm({...})) mutate()`. Render the returned element once in the screen.
 * Like every AlertDialog, Cancel has the focus first and a click outside does nothing.
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const [pending, setPending] = useState<{
    options: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);
  // Kept after closing: Radix asks where focus goes only once the dialog has gone.
  const [opener, setOpener] = useState<HTMLElement | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setOpener(options.returnFocusTo ?? (document.activeElement as HTMLElement | null));
        setPending({ options, resolve });
      }),
    [],
  );
  const finish = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };
  const options = pending?.options;

  const element = (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && finish(false)}>
      <AlertDialogContent onCloseAutoFocus={(e) => returnFocus(e, opener)}>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          {options?.description ? (
            <AlertDialogDescription asChild>
              <div>{options.description}</div>
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>
            {options?.cancelLabel ?? t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            className={options?.destructive ? buttonVariants({ variant: 'destructive' }) : ''}
            onClick={() => finish(true)}
          >
            {options?.confirmLabel ?? t('common.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return [confirm, element];
}
