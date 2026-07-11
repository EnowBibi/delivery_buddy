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

  app.setGlobalPrefix('api', { exclude: ['/'] });
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

  // Serve Swagger UI's assets from a CDN instead of local node_modules
  // files, since Vercel's serverless bundler doesn't carry static files
  // into the function — without this, /docs renders a blank page there.
  SwaggerModule.setup('docs', app, document, {
    customCssUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-standalone-preset.min.js',
    ],
  });

  return app;
}
