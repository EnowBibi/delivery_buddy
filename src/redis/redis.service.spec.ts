import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    })),
  };
});

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, fallback?: string) => fallback),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(RedisService);
    service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('returns the cached value without calling the loader on a cache hit', async () => {
    jest.spyOn(service, 'get').mockResolvedValue({ cached: true });
    const loader = jest.fn().mockResolvedValue({ cached: false });

    const result = await service.getOrSet('some-key', loader);

    expect(result).toEqual({ cached: true });
    expect(loader).not.toHaveBeenCalled();
  });

  it('calls the loader and caches the result on a cache miss', async () => {
    jest.spyOn(service, 'get').mockResolvedValue(null);
    const setSpy = jest.spyOn(service, 'set').mockResolvedValue();
    const loader = jest.fn().mockResolvedValue({ fresh: true });

    const result = await service.getOrSet('some-key', loader, 30);

    expect(loader).toHaveBeenCalled();
    expect(setSpy).toHaveBeenCalledWith('some-key', { fresh: true }, 30);
    expect(result).toEqual({ fresh: true });
  });
});
