import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WalletService } from '../wallet/wallet.service';
import { ListOrdersDto } from './dto/list-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const ROUTE_TTL = 20; // route/ETA data is third-party-sourced and short-lived
const routeKey = (orderId: string) => `order:${orderId}:route`;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly walletService: WalletService,
  ) {}

  findAll(courierId: string, query: ListOrdersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return this.prisma.order.findMany({
      where: { courierId, ...(query.status ? { status: query.status } : {}) },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findCurrent(courierId: string) {
    const order = await this.prisma.order.findFirst({
      where: { courierId, status: 'in_transit' },
      orderBy: { createdAt: 'asc' },
    });
    if (!order) throw new NotFoundException('No order currently in transit');
    return order;
  }

  async findOne(courierId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, courierId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(courierId: string, id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findFirst({ where: { id, courierId } });
    if (!order) throw new NotFoundException('Order not found');

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === 'delivered' ? { deliveredAt: new Date() } : {}),
      },
    });

    if (dto.status === 'delivered') {
      await this.walletService.creditEarning(
        courierId,
        order.id,
        Number(order.earning),
        Number(order.tip),
      );
      // Route data is no longer needed once delivered
      await this.redis.del(routeKey(order.id));
    }

    return updated;
  }

  /**
   * Returns live routing data for the tracking map screen. Wrapped in
   * Redis cache-aside so repeated polling from the client (and repeated
   * requests across couriers viewing the same order) don't hit the
   * third-party routing/ETA provider on every call.
   */
  async getRoute(courierId: string, id: string) {
    const order = await this.prisma.order.findFirst({ where: { id, courierId } });
    if (!order) throw new NotFoundException('Order not found');

    return this.redis.getOrSet(
      routeKey(id),
      () => this.fetchRouteFromProvider(order),
      ROUTE_TTL,
    );
  }

  /**
   * Stand-in for a call to a third-party maps/routing provider
   * (e.g. Google Directions, Mapbox). Replace with a real HTTP call.
   */
  private async fetchRouteFromProvider(order: {
    pickupLat: unknown;
    pickupLng: unknown;
    destinationLat: unknown;
    destinationLng: unknown;
    etaMinutes: number | null;
    distanceKm: unknown;
  }) {
    return {
      etaMinutes: order.etaMinutes ?? 7,
      distanceKm: order.distanceKm ? Number(order.distanceKm) : 1.6,
      path: [
        { lat: Number(order.pickupLat ?? 0), lng: Number(order.pickupLng ?? 0) },
        {
          lat: Number(order.destinationLat ?? 0),
          lng: Number(order.destinationLng ?? 0),
        },
      ],
      fetchedAt: new Date().toISOString(),
    };
  }
}
