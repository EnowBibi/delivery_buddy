import { createNestApp } from './bootstrap';

async function bootstrap() {
  const app = await createNestApp();
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Delivery Buddy API running on http://localhost:${port}/api/v1`);
  // eslint-disable-next-line no-console
  console.log(`Swagger docs available at http://localhost:${port}/docs`);
}
bootstrap();
