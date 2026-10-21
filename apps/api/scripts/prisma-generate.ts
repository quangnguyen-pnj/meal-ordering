/**
 * `prisma generate` that survives Windows file locks, used by `dev` and `typecheck`.
 *
 * Prisma copies each query engine (17-21 MB) to `<engine>.tmp<pid>` and renames it over the old
 * file, without retrying. On Windows the rename fails with EPERM while another process (usually
 * antivirus scanning the fresh copy) holds the file, which killed `pnpm dev` with ELIFECYCLE.
 *
 * So this script:
 * - skips generation when the generated client already matches prisma/schema.prisma. Prisma
 *   writes its schema copy last, after the engines, so a match means the last run completed;
 * - otherwise runs `prisma generate` and retries when an engine file is locked.
 *
 * `pnpm db:generate` still runs a plain, forced `prisma generate`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000;

const apiDir = path.resolve(__dirname, '..');
const sourceSchemaPath = path.join(apiDir, 'prisma', 'schema.prisma');
const prismaCliPath = require.resolve('prisma/build/index.js', { paths: [apiDir] });
// The generated client lives in `.prisma/client`, next to the `@prisma/client` package.
const generatedClientDir = path.join(
  path.dirname(require.resolve('@prisma/client/package.json', { paths: [apiDir] })),
  '..',
  '..',
  '.prisma',
  'client',
);

type GenerateOutcome =
  { kind: 'generated' } | { kind: 'engineFileLocked' } | { kind: 'failed'; exitCode: number };

function generatedClientMatchesSchema(): boolean {
  const generatedSchemaPath = path.join(generatedClientDir, 'schema.prisma');
  if (!existsSync(generatedSchemaPath)) return false;
  return readFileSync(generatedSchemaPath, 'utf8') === readFileSync(sourceSchemaPath, 'utf8');
}

/** Failed runs leave `<engine>.tmp<pid>` copies of 17-21 MB each behind. */
function removeLeftoverEngineCopies(): void {
  if (!existsSync(generatedClientDir)) return;
  const leftoverNames = readdirSync(generatedClientDir).filter((name) =>
    name.includes('.node.tmp'),
  );
  for (const name of leftoverNames) {
    try {
      rmSync(path.join(generatedClientDir, name), { force: true });
    } catch (error) {
      console.warn(`Could not remove leftover engine copy ${name}:`, error);
    }
  }
}

function runPrismaGenerate(): GenerateOutcome {
  const run = spawnSync(process.execPath, [prismaCliPath, 'generate'], {
    cwd: apiDir,
    encoding: 'utf8',
  });
  if (run.error) throw run.error;
  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr);

  if (run.status === 0) return { kind: 'generated' };
  if (`${run.stdout}${run.stderr}`.includes('EPERM')) return { kind: 'engineFileLocked' };
  return { kind: 'failed', exitCode: run.status ?? 1 };
}

async function main(): Promise<void> {
  if (generatedClientMatchesSchema()) {
    console.log('Prisma Client already matches prisma/schema.prisma; skipping prisma generate.');
    return;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    removeLeftoverEngineCopies();
    const outcome = runPrismaGenerate();
    if (outcome.kind === 'generated') return;
    if (outcome.kind === 'failed') process.exit(outcome.exitCode);
    if (attempt < MAX_ATTEMPTS) {
      console.warn(
        `A Prisma engine file is locked (attempt ${attempt}/${MAX_ATTEMPTS}); retrying in ${RETRY_DELAY_MS / 1000}s.`,
      );
      await sleep(RETRY_DELAY_MS);
    }
  }

  console.error(
    `prisma generate still failed after ${MAX_ATTEMPTS} attempts because an engine file stayed locked.\n` +
      'Stop any running api process, or exclude this repository from antivirus scanning, then retry.',
  );
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
