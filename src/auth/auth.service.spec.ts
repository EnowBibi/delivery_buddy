import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    courier: { findUnique: jest.Mock; create: jest.Mock };
    wallet: { create: jest.Mock };
  };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    prisma = {
      courier: { findUnique: jest.fn(), create: jest.fn() },
      wallet: { create: jest.fn() },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token'), verifyAsync: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key.includes('ExpiresIn') ? '15m' : 'secret')) },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('signup', () => {
    it('throws ConflictException if the email is already registered', async () => {
      prisma.courier.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.signup({ email: 'taken@example.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a courier and wallet for a new email', async () => {
      prisma.courier.findUnique.mockResolvedValue(null);
      prisma.courier.create.mockResolvedValue({
        id: 'new-id',
        email: 'new@example.com',
        createdAt: new Date(),
      });
      prisma.wallet.create.mockResolvedValue({});

      const result = await service.signup({ email: 'new@example.com', password: 'password123' });

      expect(prisma.courier.create).toHaveBeenCalled();
      expect(prisma.wallet.create).toHaveBeenCalledWith({ data: { courierId: 'new-id' } });
      expect(result.email).toBe('new@example.com');
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when the courier does not exist', async () => {
      prisma.courier.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@example.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException on an incorrect password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.courier.findUnique.mockResolvedValue({
        id: 'id',
        email: 'tyler@example.com',
        passwordHash,
        workId: 'WK-1',
      });

      await expect(
        service.login({ email: 'tyler@example.com', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns tokens on valid credentials', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.courier.findUnique.mockResolvedValue({
        id: 'id',
        email: 'tyler@example.com',
        passwordHash,
        workId: 'WK-1',
      });

      const result = await service.login({ email: 'tyler@example.com', password: 'correct-password' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });
});
