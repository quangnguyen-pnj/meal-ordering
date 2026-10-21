'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { t } from '@/messages';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog: traps Tab, closes on Escape or a backdrop click, and gives focus back to the
 * element that opened it. Rendered only while open, so the caller keeps form state simple.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** False for dialogs that must be acknowledged with a button (a one-time PIN). */
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first =
      node?.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ??
      node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && dismissible) {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-foreground/40"
        aria-hidden
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col rounded-t-lg border bg-card shadow-lg focus:outline-none sm:max-w-lg sm:rounded-lg',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-lg font-semibold leading-tight">
              {title}
            </h2>
            {description ? (
              <div id={descriptionId} className="text-sm text-muted-foreground">
                {description}
              </div>
            ) : null}
          </div>
          {dismissible ? (
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-2 shrink-0"
              aria-label={t('common.close')}
              onClick={onClose}
            >
              <X className="h-5 w-5" aria-hidden />
            </Button>
          ) : null}
        </div>
        {children ? <div className="overflow-y-auto px-5 pb-3 pt-1">{children}</div> : null}
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/**
 * Promise-based replacement for window.confirm: `if (await confirm({...})) mutate()`.
 * Render the returned element once in the screen.
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const [pending, setPending] = useState<{
    options: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ options, resolve })),
    [],
  );
  const finish = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const element = (
    <Dialog
      open={pending !== null}
      onClose={() => finish(false)}
      title={pending?.options.title ?? ''}
      description={pending?.options.description}
      footer={
        <>
          <Button variant="outline" onClick={() => finish(false)}>
            {pending?.options.cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            data-autofocus
            variant={pending?.options.destructive ? 'destructive' : 'default'}
            onClick={() => finish(true)}
          >
            {pending?.options.confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    />
  );
  return [confirm, element];
}
