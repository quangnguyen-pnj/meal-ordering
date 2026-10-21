'use client';

import { useState } from 'react';
import { returnFocus } from '@/components/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * The app's form dialog on shadcn/ui Dialog: title, optional description, body and footer.
 * Escape, the close button and a click outside all call onClose.
 */
export function AppDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  returnFocusTo,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Element to focus after closing; defaults to the element focused when the dialog opened. */
  returnFocusTo?: HTMLElement | null;
}) {
  // Remember the opener while rendering the open transition, before Radix moves focus inside.
  const [wasOpen, setWasOpen] = useState(open);
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  if (open !== wasOpen) {
    setWasOpen(open);
    // Captured now: by the time Radix asks, the caller has usually cleared its own state.
    if (open && typeof document !== 'undefined') {
      setOpener(returnFocusTo ?? (document.activeElement as HTMLElement | null));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={className}
        onCloseAutoFocus={(e) => returnFocus(e, opener)}
        // Radix warns about a dialog without a description unless told there is none.
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription asChild>
              <div>{description}</div>
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
