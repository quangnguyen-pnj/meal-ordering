# Security checklist

Run through this list before closing any phase or change request (AGENTS.md rule 13), and add to it when a review finds something new. Each item names the check that guards it, if there is one.

## Credentials (PIN, session, secrets)

- [ ] **The PIN only travels in a POST body over HTTPS.** Never in a URL, a query string, a header we log, or a GET form. Forms with a PIN input use `method="post"`, so a submit before hydration does not fall back to GET (`apps/web/src/components/forms.test.tsx`).
- [ ] **Production runs on HTTPS only.** The api refuses to start in production without `COOKIE_SECURE=true` (`apps/api/src/config/env.spec.ts`). TLS terminates at nginx or at the load balancer in front of it (`docker/nginx.conf`).
- [ ] **No response carries a PIN hash, a token hash or a configured secret.** Read only the fields you return (`select` or a mapped view), never a whole `Employee`/`AuthSession` row (`apps/api/test/security.e2e-spec.ts`; add new read endpoints to its list).
- [ ] **Errors do not echo what was sent.** Validation errors give the path and a message, never the received value (`security.e2e-spec.ts`).
- [ ] **Secrets never go into `AuditLog` before/after, logs or exceptions.** The temporary PIN from a reset is returned once to the admin and is not stored or audited in clear.
- [ ] **No API answer is cached:** `Cache-Control: no-store`, `nosniff`, no `X-Powered-By` (`apps/api/src/app.setup.ts`, `security.e2e-spec.ts`).
- [ ] **The session token stays in the httpOnly cookie,** never in a response body, `localStorage` or a URL (`auth.e2e-spec.ts`).
- [ ] **Nothing secret is committed;** `.env.example` holds placeholders only.

## Access

- [ ] Every endpoint has an explicit `@Public()`, `@Authenticated()` or `@RequirePermission()` (the guard denies a route without one), and every admin endpoint has a 403 test for out-of-scope access (`rbac.e2e-spec.ts`).
- [ ] Ids taken from the URL or body are checked against the caller's scope (factory, org unit, canteen), not only against existence.
- [ ] Development-only routes (fake clock, mock Microsoft page) are not mounted in production (`env.ts` refuses the settings).

## Input and output

- [ ] Every body and query goes through a shared Zod schema (`ZodValidationPipe`).
- [ ] Uploads have a size and row limit and are parsed, never executed; a file that is not the template is rejected.
- [ ] Spreadsheet exports write user-entered text as text cells, never as formulas; a CSV export escapes a leading `=`, `+`, `-` or `@` (formula injection).
- [ ] The web app cannot be framed (`X-Frame-Options: DENY`, `frame-ancestors 'none'` in `apps/web/next.config.ts`).

## What we decided not to do

- **No hashing or encrypting the PIN in the browser.** Seeing your own PIN in the request payload in DevTools is expected: DevTools shows what the browser sends before TLS encrypts it, and only someone already at that browser can see it. A hash made in the browser would become the password (anyone who captures it can replay it), and a 6-digit PIN has only a million values, so any hash or challenge response captured from the network can be brute-forced in seconds. HTTPS is what protects the PIN in transit; the server stores only an argon2id hash and locks the account after `pin.maxAttempts` wrong tries.

## Open follow-ups

- A full Content-Security-Policy (scripts and styles) for the web app.
- Per-IP rate limiting on `/api/auth/pin/login`, in addition to the per-account lock.

## How to check (review of 2026-10-24)

```bash
pnpm --filter @meal/api test -- security env.spec   # leaks, headers, COOKIE_SECURE in production
pnpm --filter @meal/web test -- forms               # PIN forms post natively
curl -sI localhost:3001/api/auth/me                 # cache-control: no-store, nosniff
```

In the browser: DevTools → Network → disable JavaScript, sign in, and check the URL stays `/login` with no `pin=`.
