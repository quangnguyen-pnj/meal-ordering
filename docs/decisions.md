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
- `mealDisplayName` (BR-12) shows `[Loại] Tên món`, e.g. "[Chay] Gạo lứt muối mè", with literal brackets. The plan's example "Mặn Cá kho tộ" has none; the product owner chose brackets on 2026-10-21.
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
- **"Đầu mối nhận cơm" is the UI name for the BRQ "đơn vị suất ăn"** (product owner, 2026-10-22): admins found "đơn vị suất ăn" unclear next to every node. Code, API and docs keep "meal unit" / BR-60. The "unassigned" tab is labelled "Chưa đăng ký cơm được", since it also lists employees whose meal unit lacks a floor or canteen.
- **`/admin/org` explains the meal-unit flag** instead of a bare checkbox:
  - A Có/Không choice says what each answer does for the node's employees.
  - A "Hiện trạng" line shows which meal unit the node's employees follow, where they eat, and how many cannot register.
  - Floor and canteen hints name the meal units a value set on this node reaches. A value with no reach is dimmed, because floor and canteen are only read at meal units (BR-63).
  - Cost center sits in its own "Chi phí" section, since it is resolved per employee.
  - The tree marks each node with its group: meal units show "Đầu mối nhận cơm · N người", other nodes show "→ <meal unit>", and nodes with employees but no meal unit show a warning.
  - "Chỉ xem đầu mối nhận cơm" lists every meal unit with its path, headcount, floor, canteen and validity.
  - The tree API now returns each node's effective `mealUnitId` (BR-60). Counts and reach are derived client-side in `lib/org-tree.ts`.

### Tooling

- **Tests on Linux without the embedded PostgreSQL's ICU 60:** set `TEST_DATABASE_URL` to an empty disposable database (the existing escape hatch). Test files clean up what they create, except `ForecastLine` rows, which are write-once by design.

## P1 UI review (between P1 and P2)

A UI/UX pass over every P1 screen, asked for after a review. No business rule changed; the only API change is that a removed-dish notice now carries `lockTime`.

- **Navigation:** screens that are still placeholders stay in the menu, greyed out with a "Sắp có" badge, and are not links (`NavItem.available`). Flip `available` when a phase delivers a screen. `/` still lands on `/today` (P2); its placeholder links to `/week` meanwhile.
- **Loading:** `app/(app)/loading.tsx` shows a skeleton while a screen renders, and the clicked menu item shows a spinner (`useLinkStatus`, Next 15.3+). Lists show skeleton rows instead of "Đang tải…".
- **Phones and desktops are both targets** (office staff and guards use phones; production workers have no phone at work and no company email, no kiosk). On phones the header is one row and the account block moved into the menu; the employee list turns into cards; tables scroll sideways instead of squeezing columns.
- **Dialogs instead of `window.confirm` and top-of-page forms** (`components/ui/dialog.tsx`, `useConfirm`). The one-time temporary PIN opens in a dialog that has to be acknowledged, so it can never appear off-screen.
- **Settings save together:** edits are drafts until "Lưu thay đổi (n)" in a sticky bar. Each changed key is still its own `PUT` (validated and audited per key); a partial failure keeps the failed drafts and shows the error on that row. Times are typed as 24-hour `HH:mm` text, because a native time input follows the browser locale (12-hour on English systems).
- **Org panel keeps auto-saving** (one audited `PATCH` per change, as before) but says what it saved and offers "Hoàn tác", which sends the previous value as another audited change.
- **Granting roles uses an employee search** (`EmployeePicker`, `/employees?q=`), so the admin sees the name before granting; it searches within the admin's own scope.
- **Menu builder:** each day has "Thêm món", which opens a picker; this replaces "select a day, then Thêm in the library". Dragging from the library stays on wide screens. The unusual-mix note (BR-13) only shows once a day has dishes. Publishing is confirmed in a dialog that repeats the deadline.
- **Login:** Microsoft stays on top (staff with a company email); code + PIN below for workers. PIN fields have a show/hide toggle. Employee codes are not upper-cased on the client while Q4 is open.
- **Rule 3 fix:** the "dish removed" notice said "trước 08:00"; it now uses `lockTime` from the notice payload (the `day.lockTime` setting when the menu was edited). Older notices without it say "trước giờ khóa".

### shadcn/ui throughout

- **Every UI primitive is shadcn/ui** (`apps/web/components.json`, style new-york, Tailwind 3 with `tailwindcss-animate`): Button, Input, Label, Card, Badge, Alert, Table, Tabs, Checkbox, Dialog, AlertDialog, Sheet, Select, Popover, Command, DropdownMenu, Tooltip, Separator, Skeleton and Sonner. Add new ones with `pnpm dlx shadcn@latest add <name>` from `apps/web`. Local changes to the generated files: 44 px touch sizes, `warning`/`success` variants on Alert and Badge, `CardTitle` is the page `<h1>`.
- **Selects follow the device** (`ResponsiveSelect`): a native `<select>` styled like the trigger when the primary pointer is a finger (`(pointer: coarse)`, phones and tablets), so the OS picker opens; the Radix Select with a mouse. Radix reserves `""`, so "Tất cả" / "Kế thừa" travel as a sentinel inside the component.
- **Dialogs return focus to their opener.** Radix only does that for a `Dialog.Trigger`; ours open from code (row menus, handlers), so `AppDialog` and `useConfirm` remember the opener when they open. Confirmations use AlertDialog (Cancel has the first focus, a click outside does nothing); the one-time PIN is an AlertDialog too.
- **Success messages are toasts** (Sonner), with "Hoàn tác" where a change can be reversed (org mapping, archiving a dish). Errors stay inline next to what failed.
- **Kept outside shadcn:** the org tree (no tree primitive), the menu builder's drag-and-drop (dnd-kit), the 24-hour time and PIN fields (built on Input).

### Menu builder drag and drop, and the block style

- **Dragging uses a `DragOverlay`** rendered on `document.body`. The library scrolls (`overflow-y: auto`), so a dish moved by a transform inside it was clipped as soon as it left the library. The entry stays in place, dimmed, and the moving copy says what the drop will do ("Thêm vào Thứ Ba" / "Đổi món …").
- **Dropping a dish on a dish replaces it** (BR-14 once published); dropping it anywhere else on the day adds it; a dessert always joins the day. With a pointer the dish under the cursor wins over its day (`pointerWithin`); keyboard drags use the nearest target. `resolveDrop` holds the rule and is unit-tested.
- **Below 1024 px (`lg`)** the library is hidden, so each day shows "+ Thêm món" and each published dish its "Đổi thành" select. From 1024 px up both are hidden and drag and drop is the only way (by choice of the administration).
- **Blocks are set apart by shadows, not borders**, on a faint warm page background (`--canvas`). Tokens in `tailwind.config.ts`: `shadow-block` (cards, panels, rows), `shadow-raised` (menus, popovers, select lists), `shadow-overlay` (dialogs, sheets, the drag copy). Not `shadow-card`: `card` is also a colour, and Tailwind would then generate a white shadow colour for the same class. Inputs keep their borders; tables keep light row dividers. Inner padding went from 12 to 16 px and page padding to 32 px on desktop.

## Phase 2 – Registration

### Rules (packages/shared)

- `validateDaySelection` (BR-20): any dish of that day's published menu, several dishes and types, each a non-negative integer; no row or 0 means no meal. The same item twice in one selection is rejected as ambiguous. The `maxPerDay` option is the hook BR-20 keeps for a future cap; every caller passes nothing (no cap).
- `employeeDayWindow` (BR-22 to BR-24): `OPEN` before closeAt and the day's lock, `AFTER_CLOSE` from closeAt (or once the snapshot exists) to the lock, `LOCKED` from `day.lockTime` on day D. A late closeAt never passes a day's own lock (BR-05).
- `adminDayWindow` (BR-21, BR-25): `ON_BEHALF` until the lock, then `EXTRA` until finalization. Finalization (DayClose) is P4, so for now the extra window also ends when day D ends (Q20).
- `forecastLinesOf` (BR-07): the forecast is active lines with a positive quantity. Lines waiting for reselection (BR-14) are not in it (Q21).
- `compareWithForecast` (BR-23) gives per-meal forecast, actual and difference. Screens use it to mark a day "Khác dự báo".
- `sameAsLastWeek` / `applyToWholeWeek` (BR-26) add up quantities by type and put them on the **first** dish of that type on the target day, as BR-26 says for "Same as last week". "Apply to whole week" uses the same rule for consistency. A type missing on the target day is reported, never invented. Nothing is saved until the user presses Save.
- `isLostByLeaver` (BR-36): a leaver loses meals dated on or after `endDate`, unless that day's lock has already passed. Locked days are left to reconciliation (Q23).
- `DateStringSchema` now rejects impossible dates (`2027-02-30`), so a bad path or query date is a 400, not a 500.

### API

- **New endpoints**, all behind the guard. Each admin endpoint has a 403 test: `/api/registrations/me/{week,day,days/:date,history}` (`menu.registerOwn`, self); `/api/team` and `/api/team/units/:orgUnitId` (`team.view`); `/api/admin/registrations/{units,progress,not-registered}` (list scope); `/api/admin/registrations/units/:orgUnitId/{grid,days/:date}` (`registration.onBehalf`, org-unit scope); `/api/admin/registrations/employees/:code/extras` (`registration.addExtra`, employee scope).
- **Saves are all or nothing.** A week save validates every day first. One changed day that is locked rejects the whole save with `409 DAY_LOCKED` (new error code). A locked day sent unchanged is skipped, so `/week` can always send the full week. The grid saves one day for many employees; one bad row rejects the batch with `{ employeeCode, code, menuItemId? }` details.
- **Rows are never deleted** (rule 7). Removing a meal keeps the row with quantity 0. Saving a day with a new selection resolves its "needs reselection" rows by cancelling them.
- **The grid works on any org node in scope, not only meal units.** A dept admin assigned below a meal unit can still open their own team. Rows are employees below the node who can register, for one canteen at a time (the most common one by default). The response counts the employees it leaves out.
- **Extras (BR-25)** reuse the employee's row for that meal (one row per employee and item in the plan's model): quantity goes up, `isExtra` and `extraReason` are set, and the audit log keeps each addition with its reason.
- **Audit (BR-70):** employee changes after closeAt (`registration.changedAfterClose`), every admin on-behalf change per employee-day (`registration.onBehalf`), extras with their reason, the snapshot itself (`forecast.snapshot`), and each automatic cancellation (`registration.cancelledUnselected`, `registration.cancelledLeaver`, no actor). Employee edits before closeAt are not audited (neither admin actions nor changes after closeAt).
- **"Now" for screens comes from the API** (`now` in the day view, `upcomingWeekStart` from `/units`, the history range), so the web never reads the clock and follows fake time. The week view defaults to the first of the next two weeks that is published and still before closeAt (J1).
- `/team` shows only `key` (employee id), name, meals and eating; no code, no reason (BR-27). Search by code works on the server.
- The not-registered list (BR-21) is everyone in scope who can register, whose canteen's menu is published, and who has no meal in the week (or on the chosen day) (Q22).

### Forecast snapshot (BR-07)

- **`close-week` runs every minute** and snapshots every published week whose closeAt has passed (closeAt differs per week under BR-04). `reselect-deadline` also runs every minute (BR-14 at the lock). Both are idempotent.
- **Self-healing:** every registration request first takes any snapshot that is due, so a missed job never lets a later change into the forecast. Writes take `FOR SHARE` on the week row and the snapshot's conditional update takes the row lock. A write therefore lands either before the snapshot (it is in the forecast) or after it (it is a difference). After the lock, the write re-reads `closedAt` and audits accordingly.
- Snapshot lines carry the meal unit, floor and cost center resolved at that moment, plus the week's canteen (BR-64). The week becomes `CLOSED`, which every menu screen already treats as published.

### Jobs and sync

- **BR-36 in the org sync:** after employees are written, registrations on or after a leaver's `endDate` are cancelled in the same transaction. The count is in `SyncRun.details.mealsCancelledForLeavers`. Employees whose `endDate` is set in DMP cannot register for those days either.
- The BR-14 TODO in `menu.service.ts` is resolved by `ForecastService.cancelUnselectedAtLock`.

### Web

- Screens: `/week` (steppers, closeAt banner, BR-26 shortcuts, per-day lock and difference), `/today` (forecast vs current, countdown from server time, "Không ăn hôm nay", read-only after the lock), `/team`, `/history`, `/admin/registrations` (progress, not-registered, bulk grid with day tabs, Enter moves down, invalid cells on the row, extras with a reason after the lock), `/admin/print` (one table per day, same row order as the grid, browser print CSS).
- **Built on the shadcn/ui conventions of the P1 UI review** (merged from main before P2 closed): `ResponsiveSelect` for every select, Radix `Tabs` (also the grid's day tabs), shadcn `Table`, `WeekNav` with "Về tuần sắp tới", `LoadingRows`, `useConfirm` instead of `window.confirm` (leaving unsaved changes, "Không ăn hôm nay"), `AppDialog` for extras, toasts for success with errors kept inline, `shadow-block` day blocks, and the full-width sticky save bar of /admin/settings. The P2 screens are now `available` in the navigation.
- **Tablets keep the sidebar from `md`**, as main decided ("tables scroll sideways instead of squeezing columns"). At 768 px the bulk grid scrolls sideways with its name column pinned, so the row being typed is always identified. An earlier P2 draft moved the sidebar to `lg`; that was dropped in the merge.
- **A removed-dish notice (BR-14) links to `/week`** ("Chọn lại món"), because it now asks something of the employee before the lock.
- `registration-draft.ts` and `grid-draft.ts` hold the screen logic as pure functions with unit tests. The P1 read-only `week-menu-screen.tsx` is replaced by the registration screen.

### Tooling

- **`apps/web/tsconfig.json` maps `vitest` to the app's own copy.** pnpm installs two copies of vite/vitest (one per `jiti` peer). `@testing-library/jest-dom`'s vitest types resolved the hoisted copy, so `vitest.config.ts` saw a `defineConfig` without `test` and `pnpm typecheck` failed on a fresh install.
- **Linux without the embedded PostgreSQL's ICU 60:** run the API tests against a local server with `TEST_DATABASE_URL=postgresql://…/meal_test pnpm --filter @meal/api test`. Turbo does not pass that variable through, so run the API package directly. The e2e suite leaves write-once `ForecastLine` rows behind, so use a fresh database for each run.
