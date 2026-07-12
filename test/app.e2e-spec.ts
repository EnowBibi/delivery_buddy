import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('AppController / Auth (e2e)', () => {
  let app: INestApplication;

  const prismaMock = {
    courier: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    wallet: { create: jest.fn(), findUnique: jest.fn() },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  const redisMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delByPrefix: jest.fn(),
    getOrSet: jest.fn((_key: string, loader: () => unknown) => loader()),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
      });
  });

  it('POST /api/v1/auth/signup rejects an invalid email with 400', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email: 'not-an-email', password: 'password123' })
      .expect(400);
  });

  it('POST /api/v1/auth/signup rejects a short password with 400', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email: 'valid@example.com', password: 'short' })
      .expect(400);
  });

  it('POST /api/v1/auth/signup succeeds with valid input', () => {
    prismaMock.courier.findUnique.mockResolvedValue(null);
    prismaMock.courier.create.mockResolvedValue({
      id: 'courier-id',
      email: 'valid@example.com',
      createdAt: new Date(),
    });
    prismaMock.wallet.create.mockResolvedValue({});

    return request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email: 'valid@example.com', password: 'password123' })
      .expect(201)
      .expect((res) => {
        expect(res.body.email).toBe('valid@example.com');
      });
  });

  it('POST /api/v1/auth/login returns 401 for unknown accounts', () => {
    prismaMock.courier.findUnique.mockResolvedValue(null);

    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@example.com', password: 'password123' })
      .expect(401);
  });

  it('GET /api/v1/couriers/me requires authentication', () => {
    return request(app.getHttpServer()).get('/api/v1/couriers/me').expect(401);
  });
});
