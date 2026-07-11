import type { Express } from 'express';
import { createNestApp } from '../src/bootstrap';

let cachedApp: Express;

async function bootstrapServer(): Promise<Express> {
  const app = await createNestApp();
  await app.init();
  return app.getHttpAdapter().getInstance();
}

export default async function handler(req: any, res: any) {
  if (!cachedApp) {
    cachedApp = await bootstrapServer();
  }
  return cachedApp(req, res);
}
