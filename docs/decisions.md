# Decisions log

Choices made while building, where the plan (`docs/plan.md`, MVP Plan v1.1) was silent or a tool forced a trade-off. Newest phase last. Anything that changes a business rule belongs in `open-questions.md` instead.

## Phase 0 – Foundation

### Repository and tooling

- **One repo, `meal-ordering`.** A single pnpm + Turborepo monorepo (`apps/api`, `apps/web`, `packages/shared`).
- **`docs/plan.md` is not committed** (it is git-ignored). The GitHub repo is public and the plan lists unpatched DMP security findings (section 8). Keep the plan locally, or make the repo private and remove the ignore line.
- **Keep the checkout path short on Windows.** `node_modules/.pnpm/...` plus a long parent folder exceeds the Win32 working-directory limit and breaks postinstall scripts (esbuild, Prisma, argon2) and Node's package lookup. `D:\Web Programming\Projects\meal` is fine.
- **pnpm 9.15.9** pinned via `packageManager`. Node **>= 22.12** is required because `openid-client` v6 is ESM-only and the CommonJS API loads it with `require()` of an ES module.
- **ESLint enforces plan rule 3** (`no Date.now()` / `new Date()` in business code) with `no-restricted-syntax`. Only the clock service, specs, tests and the seed are exempt.
- **No `nestjs-zod`.** The plan lists it, but a 20-line `ZodValidationPipe` (`apps/api/src/common/zod-validation.pipe.ts`) gives the same shared-schema validation without a dependency pinned to a Zod major.
- **Deferred stack items:** Motion, Zustand and dnd-kit (menu builder, P1), pg-boss and exceljs (first job / first export), Playwright (P7). Nothing in P0 needs them.

### Data model and rules

- **`AuthSession.method` (`PIN` | `ENTRA`) was added** to the table in plan 6.3. A forced PIN change only applies to PIN sessions; someone signing in with Microsoft must not be asked for a PIN they never use.
- **`Employee.mealUnitId` is the nearest flagged node even when that unit is invalid** (no floor or canteen, BR-63). Validity is derived by `resolveEmployeeMealAssignment`, so the "unassigned" list can say _why_ (no meal unit vs. invalid meal unit).
- **Cost-center precedence:** employee override, then inherited org mapping, then the cost center DMP supplied for the employee. This is one reading of "DMP is the default and an admin mapping overrides it" (BR-62) and is listed in `open-questions.md`.
- **`registration.close` stores the last accepted minute** (`{ weekday: 4, time: "23:59" }`). `regularCloseAt` adds one minute and returns the exclusive instant (Friday 00:00, BR-03). Only the regular close lives in P0; late publish (BR-04, BR-05) is P1.
- **Org paths** are materialized as `/<id>/<id>/` with a trailing slash so "is within" is `startsWith` and `/ou_2/` never matches `/ou_20/`.
- **Vietnam time is a fixed UTC+7** in `rules/time.ts` (no DST since 1975), so the shared package needs no timezone library.
- **Seed ids are deterministic** (`ou_<dmpCode>`, `fl_T1`, `cc_CC01`, ...) so tests and docs can name them. The PRNG is seeded, so the 1,700 employees are identical on every run. One argon2 hash of `SEED_INITIAL_PIN` is reused for all of them (hashing 1,700 PINs would take over a minute).
- **Placeholders in the seed:** DMP company code `PNJP`, caterer unit price 35,000 VND. See `open-questions.md`.

### Authentication

- **Sessions:** 32 random bytes in an httpOnly, SameSite=Lax cookie; only the SHA-256 is stored. Lifetime `SESSION_TTL_HOURS` (default 12). Expiry is judged by `ClockService`, so fake time also ages sessions.
- **PIN lock:** `pin.maxAttempts` / `pin.lockMinutes` come from `Setting`. The fifth wrong PIN locks the account and resets the counter. A locked account refuses even the right PIN. An unknown employee code runs a dummy argon2 verify and returns the same 401 body as a wrong PIN.
- **Changing a PIN** also checks the current PIN against the same lock counter, and ends the employee's other sessions. **Resetting a PIN** (admin) ends all of the employee's sessions, clears any lock, and returns the temporary PIN once; it is never written to the audit log.
- **Entra:** `ENTRA_MODE=oidc` uses OIDC Authorization Code + PKCE (`openid-client`). It is **untested against a real tenant** because the app registration does not exist yet. `ENTRA_MODE=mock` serves a local fake sign-in page and is **rejected at startup when `NODE_ENV=production`**. The PKCE verifier and state travel in a short-lived HMAC-signed cookie. Zero or several employees matching the email both end on the "account not linked" screen.
- **First system admin:** `FIRST_SYSTEM_ADMIN_CODE` is granted `SYS_ADMIN` at API start (and by the seed). If the employee does not exist yet it retries later (the P1 employee sync should call `SystemAdminBootstrap.ensure()`).

### Authorization

- **The permission matrix (plan section 3) is data** in `packages/shared/src/rules/permissions.ts`, evaluated as (role, action, scope). The API's global `AccessGuard` and the web navigation both read it; the API is the only enforcer.
- **Fail closed:** a route with none of `@Public`, `@Authenticated` or `@RequirePermission` is denied, and a test checks every real controller route declares one.
- **Scopes are declarative** (`{ type: 'employeeParam' | 'orgUnitParam' | 'list' | 'factory' | 'system' | 'self' }`), resolved by the guard, never inside handlers. `list` routes receive `req.listScope`, which the service turns into a Prisma filter.
- **403 vs 404:** a caller who could see the whole population (HC or system admin) gets 404 for a missing resource; everyone else gets 403, so a dept admin cannot probe which employee codes exist.
- **Extra endpoints beyond the plan's P0 list**, all behind the guard: `GET /api/employees` (scoped finder next to PIN reset, gated by `pin.reset`), `GET /api/system/sync-runs` (HC and system admins, exercises a role-level 403), `GET/PUT /api/dev/clock`, `GET /api/health`.
- **Fake time** (`CLOCK_FAKE_ENABLED`) is refused when `NODE_ENV=production`, both by env validation and by `ClockService`. The `/api/dev/clock` controller is only registered when fake time is allowed, requires a system admin, and is audited.

### DMP

- `DmpClient` has four read methods. `MockDmpClient` serves the same deterministic org tree and employees as the seed, plus attendance and leave from `src/dmp/mock/scenarios.json` (`on-time`, `late`, `forgot-to-check-in`, `morning-leave`, `afternoon-leave`, `api-error`, `too-little-data`), chosen with `DMP_MOCK_SCENARIO`.
- `HttpDmpClient` is a skeleton: service-token login, a request helper with the 10 s timeout and 3 retries with backoff. The endpoint methods reject with `NOT_IMPLEMENTED` until P1 (org, employees) and P3 (attendance, leave).

### Web

- **Next.js 15 (App Router), React 19, Tailwind CSS 3.4.** shadcn-style components are hand-written (`components/ui`). `output: 'standalone'` is switched on only with `NEXT_OUTPUT=standalone` (the Docker build), because tracing creates symlinks that ordinary Windows accounts cannot.
- **Navigation is derived from the permission matrix**, so it can disagree with the plan's 4.1 screen table in two places: the system admin also sees `/admin/org`, `/admin/master`, `/admin/employees`, and `/admin/settings`, because the matrix grants those. See `open-questions.md`.
- **Placeholder pages:** every route in the navigation registry renders "coming in phase Px" through one catch-all page; unknown routes are 404. The banner area exists but is fed an empty list until P1/P3/P4.
- **Auth gate:** `middleware.ts` only checks that the cookie exists; the `(app)` layout validates it against `/api/auth/me` on every request and redirects to `/login` or `/change-pin`.
- The browser only calls same-origin `/api`. In `pnpm dev` a Next rewrite proxies it to `API_INTERNAL_URL`; in Docker nginx does.

### Infrastructure

- **No Docker on the build machine**, so `docker-compose.yml` and the Dockerfiles were written but **not built or run here**. Their pieces were checked separately: the compiled API against a real PostgreSQL, the web production build in a browser, and the compose YAML parses.
- **Tests use a real PostgreSQL without Docker** (`embedded-postgres`, started by `apps/api/test/global-setup.ts`, initialised as UTF8 because the Windows default code page cannot store Vietnamese). `pnpm --filter @meal/api db:local` runs the same thing as a persistent dev database. Set `TEST_DATABASE_URL` to use an existing empty database instead.
- The compose stack runs with `NODE_ENV=development` and seeds on start so there is something to sign in with; production needs `ENTRA_MODE=oidc`, a real `SESSION_SECRET` and no seed.
- The API image keeps dev dependencies because the entrypoint needs the Prisma CLI (`migrate deploy`) and `tsx` (seed). Slimming it is a P7 job.
- **`pnpm dev` runs the API through `tsc-watch`, not `tsx`.** Nest resolves constructor dependencies from `emitDecoratorMetadata`, which esbuild (inside `tsx`) does not emit, so `tsx watch` crashed at boot and the web proxy answered every `/api` call with 500. `tsx` is still fine for the seed and scripts, which use no Nest DI.
