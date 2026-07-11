import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, INestApplication } from '@nestjs/common';
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
  SwaggerModule.setup('docs', app, document);

  return app;
}
