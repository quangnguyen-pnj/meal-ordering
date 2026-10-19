import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/** Middleware and prefix shared by main.ts and the e2e tests, so tests run the real configuration. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.use(cookieParser());
}
