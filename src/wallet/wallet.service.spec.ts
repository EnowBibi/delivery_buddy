import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('WalletService', () => {
  let service: WalletService;
  let prisma: any;
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock; getOrSet: jest.Mock };

  beforeEach(async () => {
    prisma = {
      wallet: { findUnique: jest.fn(), update: jest.fn() },
      transaction: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      getOrSet: jest.fn((_key, loader) => loader()),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = moduleRef.get(WalletService);
  });

  describe('findByCourier', () => {
    it('throws NotFoundException when no wallet exists', async () => {
      prisma.wallet.findUnique.mockResolvedValue(null);

      await expect(service.findByCourier('courier-id')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the wallet via the cache-aside helper', async () => {
      prisma.wallet.findUnique.mockResolvedValue({ id: 'wallet-id', balance: 100 });

      const result = await service.findByCourier('courier-id');

      expect(redis.getOrSet).toHaveBeenCalled();
      expect(result).toEqual({ id: 'wallet-id', balance: 100 });
    });
  });

  describe('withdraw', () => {
    it('throws BadRequestException when balance is insufficient', async () => {
      prisma.wallet.findUnique.mockResolvedValue({ id: 'wallet-id', balance: 50 });

      await expect(service.withdraw('courier-id', { amount: 100 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('debits the wallet and invalidates the cache on success', async () => {
      prisma.wallet.findUnique
        .mockResolvedValueOnce({ id: 'wallet-id', balance: 200 })
        .mockResolvedValueOnce({ id: 'wallet-id', balance: 100 });
      prisma.transaction.create.mockResolvedValue({ id: 'txn-id' });

      const result = await service.withdraw('courier-id', { amount: 100 });

      expect(redis.del).toHaveBeenCalledWith('wallet:courier-id');
      expect(result).toEqual({
        transactionId: 'txn-id',
        newBalance: 100,
        status: 'completed',
      });
    });
  });
});
