const MS_PER_MINUTE = 60_000;

/** True while the account is temporarily locked by repeated wrong PINs. */
export function isPinLocked(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && now.getTime() < lockedUntil.getTime();
}

export interface PinFailureState {
  failedCount: number;
  lockedUntil: Date | null;
}

/**
 * State after one more wrong PIN. Reaching `maxAttempts` locks the account for `lockMinutes`
 * and restarts the counter, so the next window starts clean once the lock expires.
 */
export function registerPinFailure(args: {
  failedCount: number;
  maxAttempts: number;
  lockMinutes: number;
  now: Date;
}): PinFailureState {
  const failedCount = args.failedCount + 1;
  if (failedCount >= args.maxAttempts) {
    return {
      failedCount: 0,
      lockedUntil: new Date(args.now.getTime() + args.lockMinutes * MS_PER_MINUTE),
    };
  }
  return { failedCount, lockedUntil: null };
}
