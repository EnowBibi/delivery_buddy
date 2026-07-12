import { NestFactory } from '@nestjs/core';
import {
  ValidationPipe,
  VersioningType,
  INestApplication,
} from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Shared app configuration used by both:
 *  - main.ts (local dev / Railway / Render — calls app.listen())
 *  - api/index.ts (Vercel serverless — wraps this in a request handler)
 */
export async function createNestApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Delivery Buddy API')
    .setDescription(
      'REST API powering the Delivery Buddy courier web/mobile app: auth, shifts, wallet, orders, chat, notifications and settings.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    customCssUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-standalone-preset.min.js',
    ],
  });

  // Bare root ("/") handled directly on the underlying Express instance,
  // completely bypassing Nest's global prefix and versioning. This avoids
  // any ambiguity with the /api/v1 root route defined in AppController.
  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance.get('/', (_req: any, res: any) => {
    res.json({
      status: 'ok',
      message: 'Delivery Buddy API is running',
      docs: '/docs',
      api: '/api/v1',
    });
  });

  return app;
}
