import { Handler } from 'aws-lambda';
import serverlessExpress from '@vendia/serverless-express';
import { createNestApp } from '../src/bootstrap';

let cachedHandler: Handler;

/**
 * Vercel serverless entry point. Reuses `createNestApp()` from src/bootstrap.ts
 * so behavior (Swagger, validation, filters) matches the local/main.ts server.
 * The Nest app instance is cached across invocations of the same warm
 * function instance, avoiding a full app rebuild (and a fresh Prisma/Redis
 * connection) on every request.
 */
async function bootstrapServer(): Promise<Handler> {
  const app = await createNestApp();
  await app.init();
  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp });
}

export default async function handler(req: any, res: any) {
  if (!cachedHandler) {
    cachedHandler = await bootstrapServer();
  }
  return cachedHandler(req, res, () => {});
}
