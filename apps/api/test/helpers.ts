import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { loadEnv, type AppEnv } from '../src/config/env';
import { DEMO } from '../src/seed-data';

export const INITIAL_PIN = '123456';
export { DEMO };

export function testEnv(overrides: Record<string, string | undefined> = {}): AppEnv {
  return loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: 'test-secret-test-secret-test-secret-1234',
    CLOCK_FAKE_ENABLED: 'true',
    ENTRA_MODE: 'mock',
    DMP_MODE: 'mock',
    ...overrides,
  });
}

export async function createTestApp(
  overrides: Record<string, string | undefined> = {},
  extraControllers: Type<unknown>[] = [],
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(testEnv(overrides))],
    controllers: extraControllers,
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

let sharedPrisma: PrismaClient | undefined;
export function db(): PrismaClient {
  sharedPrisma ??= new PrismaClient();
  return sharedPrisma;
}
export async function closeDb(): Promise<void> {
  await sharedPrisma?.$disconnect();
  sharedPrisma = undefined;
}

/** Puts an employee back into the seeded state: initial PIN, change required, no lock. */
export async function resetEmployee(
  employeeCode: string,
  state: { pin?: string; pinMustChange?: boolean } = {},
): Promise<void> {
  const pin = state.pin ?? INITIAL_PIN;
  const employee = await db().employee.update({
    where: { employeeCode },
    data: {
      pinHash: await argon2.hash(pin, { type: argon2.argon2id }),
      pinMustChange: state.pinMustChange ?? true,
      pinFailedCount: 0,
      lockedUntil: null,
    },
  });
  await db().authSession.deleteMany({ where: { employeeId: employee.id } });
}

export type Agent = ReturnType<typeof request.agent>;

/** Signs in with employee code + PIN and returns a cookie-carrying agent. */
export async function signIn(
  app: INestApplication,
  employeeCode: string,
  pin = INITIAL_PIN,
): Promise<Agent> {
  const agent = request.agent(app.getHttpServer());
  await agent.post('/api/auth/pin/login').send({ employeeCode, pin }).expect(200);
  return agent;
}

/**
 * Seeds the employee with a known non-temporary PIN and signs them in, so tests of other
 * features are not blocked by the forced PIN change.
 */
export async function signInReady(app: INestApplication, employeeCode: string): Promise<Agent> {
  await resetEmployee(employeeCode, { pinMustChange: false });
  return signIn(app, employeeCode);
}
