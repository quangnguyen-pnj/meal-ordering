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

## Phase 1 – Org structure and menu

### Data model

- **Migration `20261020000000_p1_org_menu`** adds `Dish`, `Dessert`, `MenuWeek`, `MenuDay`, `MenuItem`, `MenuDayDessert`, `Registration`, `ForecastLine`, `Notification`, `MappingImport`, plus `OrgUnit.dmpCostCenterCode`, `RoleAssignment.revokedAt` and `SyncRun.details`.
- **`Registration` and `ForecastLine` exist from P1, without their flows.** BR-14 (P1) has to move or flag registrations, and the P1 exit criterion "changing a mapping leaves existing snapshot rows unchanged" needs snapshot rows. Registration flows and the close-week job that writes `ForecastLine` stay in P2.
- **`ForecastLine` is write-once in the database**: a trigger rejects `UPDATE` and `DELETE` (rule 7). `FinalEmployeeLine` and `FinalCount` get the same trigger in P4.
- **Nothing on a menu is deleted.** Removed or replaced items and desserts get `removedAt`. A replaced item points to its replacement (`replacedByItemId`). BR-14's "move registrations to the replacement" is done literally: a new item is created and the registrations move to it, so forecast lines keep the item they were taken against.
- **Role assignments are revoked, not deleted** (`revokedAt`). Revocation takes effect on the next request, because the principal is loaded on every request. `FIRST_SYSTEM_ADMIN_CODE` does not re-grant a revoked first admin.

### Rules (packages/shared)

- `computeCloseAt` (BR-03, BR-04): published before the regular closeAt keeps it; at or after it, closeAt = publish + `registration.latePublishHours`. Publishing at exactly Friday 00:00 is already late, because closeAt is exclusive.
- `dayFreeEditDeadline` (BR-05) = the earlier of closeAt and the day's own `day.lockTime`.
- `lastAcceptedMinute` (BR-03 display): screens show closeAt minus one minute, worded "đến hết 23:59" ("until 23:59"). The same applies to a late closeAt (see Q19).
- `menuPublishWarnAt` / `isMenuPublishWarningDue` / `upcomingWeekStart` (BR-06): the warning concerns next Monday's week and starts at `menu.publishWarnAt` of the current week.
- `checkMenuMix` (BR-13): the usual mix (1 Chay, 1 Cháo, 2–3 Mặn) is a constant in the rule, not a setting; plan 6.4 has no key for it. It only warns.
- `planMenuDayEdit` (BR-11, BR-14): a saved day is a list of `{ id?, dishId }`. An existing id with a new dish is a replacement, a missing id is a removal, and the same dish twice on a day is rejected.
- `buildDmpTree` / `mapDmpLevel` (BR-61): the level is the depth from the root (assumption A14). Any duplicate code, unknown parent, cycle or 7th level rejects the whole tree.
- `validateMappingRows` (BR-64): a row states the complete mapping of its target, and a blank cell means "inherit". Exporting and re-importing the same file therefore changes nothing; a test proves the round trip. Employee rows may only set the cost center (BR-63).

### API

- **New endpoints**, all behind the guard with a 403 test each: `/api/admin/dishes`, `/api/admin/desserts` (`dishes.manage`); `/api/admin/menu/*` (`menu.manage`); `/api/menu/my-week` (`menu.registerOwn`, self); `/api/admin/master/*` and `/api/admin/org/*` (`org.manage`; sync is `sync.manage`); `/api/employees/:code/cost-center-override` (`org.manage`); `/api/admin/settings`, `/api/admin/supplier` (`settings.manage`); `/api/system/roles` (`roles.assignPrivileged`); `/api/me/banners`, `/api/me/notifications/:id/read` (any signed-in user, always filtered to the caller).
- **`GET /api/employees`** now returns the resolved meal unit, floor, canteen and cost center (with names and source), and filters by org node, floor, canteen, cost center, meal status and status. Floor, canteen and cost center are inherited values, so it filters after resolution in memory (about 1,700 employees).
- **Mapping import** is multipart (`file`, max 5 MB). The upload is validated and stored as `MappingImport` (PREVIEW or REJECTED); applying re-validates against current master data, locks the import row (`FOR UPDATE`) and writes every change plus one audit entry per changed target in one transaction. The second sheet of the export lists the valid codes.
- **Org sync** reads DMP first, validates, then writes everything in one transaction under a Postgres advisory lock. It never touches meal-unit flags or mapping, deactivates nodes missing from DMP, creates DMP-sourced cost centers it has not seen, recomputes meal units, then calls `SystemAdminBootstrap.ensure()`. Employees whose node is unknown are skipped and listed in `SyncRun.details`. New employees have no PIN, so they sign in with Microsoft or get a PIN reset.
- **`HttpDmpClient.getOrgTree` / `getEmployees`** are implemented with sequential pages of 500. Field names are a best reading of the survey and live in `dmp-parsers.ts` with a TODO (Q17).
- **Publishing a menu needs a saved week** and is a conditional update, so two clicks cannot both publish. A published week stays editable under BR-14 except for days whose lock has passed (Q15) and turning a serving day off (Q16).
- **BR-14 notices** go only to employees with registrations on the changed item. They are shown as dismissable banners.

### Jobs

- **pg-boss 10** (CommonJS; v11+ is ESM-only), in schema `pgboss`, both jobs scheduled with `tz: Asia/Ho_Chi_Minh`. `sync-org-employees` runs at 02:00. `menu-publish-warning` runs hourly and checks `menu.publishWarnAt` itself, so a changed setting needs no new schedule. The BR-06 banner is computed on every request, so the job only logs.
- **`JOBS_ENABLED`** (default true) turns pg-boss off; tests set it false and call the handlers directly.

### Web

- Screens: `/admin/dishes`, `/admin/menu`, `/admin/master`, `/admin/org`, `/admin/employees`, `/admin/settings`, `/system`, and `/week`, which shows the published menu read-only until registration arrives in P2. Other routes still use the placeholder.
- **Menu builder:** the week draft lives in a Zustand store (`lib/menu-builder-store.ts`, unit-tested); dnd-kit drags library entries onto day columns. Every drag action also has a button (select a day, then "Thêm"), so it works with a keyboard and on a tablet. The mix warning is computed live with the shared rule.
- The layout fetches `/api/me/banners` on every request. Notices can be dismissed.

### Tooling

- **Tests on Linux without the embedded PostgreSQL's ICU 60:** set `TEST_DATABASE_URL` to an empty disposable database (the existing escape hatch). Test files clean up what they create, except `ForecastLine` rows, which are write-once by design.
