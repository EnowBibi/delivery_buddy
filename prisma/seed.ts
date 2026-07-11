import {
  PrismaClient,
  TransportationType,
  CourierStatus,
  ShiftStatus,
  TransactionType,
  OrderStatus,
  PaymentMethod,
  SenderType,
  NotificationType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.courierSettings.deleteMany();
  await prisma.courier.deleteMany();
  await prisma.team.deleteMany();

  const teamA = await prisma.team.create({
    data: {
      name: 'Lagos Riders',
    },
  });

  const teamB = await prisma.team.create({
    data: {
      name: 'Nairobi Connect',
    },
  });

  const passwordHash = await bcrypt.hash('password123', 10);

  const couriers = await prisma.courier.createMany({
    data: [
      {
        workId: 'WK-001',
        name: 'Adebayo Okafor',
        email: 'adebayo.okafor@deliverybuddy.com',
        phone: '+2348012345678',
        passwordHash,
        avatarUrl:
          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
        teamId: teamA.id,
        transportationType: TransportationType.bicycle,
        vehicleNumber: 'LAG-101-AB',
        status: CourierStatus.active,
        level: 3,
        currentRate: 4.8,
      },
      {
        workId: 'WK-002',
        name: 'Nadia Hassan',
        email: 'nadia.hassan@deliverybuddy.com',
        phone: '+254712345678',
        passwordHash,
        avatarUrl:
          'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
        teamId: teamB.id,
        transportationType: TransportationType.car,
        vehicleNumber: 'NBI-202-CD',
        status: CourierStatus.active,
        level: 4,
        currentRate: 5.1,
      },
      {
        workId: 'WK-003',
        name: 'Kwame Boateng',
        email: 'kwame.boateng@deliverybuddy.com',
        phone: '+233542345678',
        passwordHash,
        avatarUrl:
          'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d',
        teamId: teamA.id,
        transportationType: TransportationType.truck,
        vehicleNumber: 'ACC-303-EF',
        status: CourierStatus.active,
        level: 2,
        currentRate: 4.3,
      },
    ],
  });

  const createdCouriers = await prisma.courier.findMany({
    orderBy: { createdAt: 'asc' },
  });

  for (const courier of createdCouriers) {
    await prisma.wallet.create({
      data: {
        courierId: courier.id,
        balance: 1500 + Math.floor(Math.random() * 1000),
        tipsBalance: 120 + Math.floor(Math.random() * 300),
        rateTrendPct: 2.5,
      },
    });

    await prisma.shift.create({
      data: {
        courierId: courier.id,
        status: ShiftStatus.active,
        earned: 300 + Math.floor(Math.random() * 200),
        tips: 20 + Math.floor(Math.random() * 50),
        deliveriesCompleted: 8 + Math.floor(Math.random() * 5),
      },
    });

    await prisma.courierSettings.create({
      data: {
        courierId: courier.id,
        fuelManagement: { enabled: true, threshold: 100 },
        billingMethod: { method: 'mobile_money', provider: 'mtn' },
      },
    });
  }

  const orders = await prisma.order.createMany({
    data: [
      {
        orderNumber: 'ORD-1001',
        courierId: createdCouriers[0].id,
        status: OrderStatus.delivered,
        pickupName: 'Kofi Foods',
        pickupAddress: '12 Broad Street, Lagos Island, Nigeria',
        customerName: 'Chiamaka Ayo',
        customerPhone: '+2348134567890',
        destinationAddress: '45 Allen Avenue, Ikeja, Nigeria',
        paymentMethod: PaymentMethod.cash,
        subtotal: 4500,
        total: 5000,
        earning: 500,
        tip: 100,
        etaMinutes: 18,
        distanceKm: 6.8,
      },
      {
        orderNumber: 'ORD-1002',
        courierId: createdCouriers[1].id,
        status: OrderStatus.in_transit,
        pickupName: 'Mambo Market',
        pickupAddress: 'Westlands, Nairobi, Kenya',
        customerName: 'Moses Kamau',
        customerPhone: '+254723456789',
        destinationAddress: 'Kilimani, Nairobi, Kenya',
        paymentMethod: PaymentMethod.wallet,
        subtotal: 3200,
        total: 3500,
        earning: 350,
        tip: 75,
        etaMinutes: 12,
        distanceKm: 4.2,
      },
      {
        orderNumber: 'ORD-1003',
        courierId: createdCouriers[2].id,
        status: OrderStatus.pending,
        pickupName: 'Accra Fresh',
        pickupAddress: 'Accra Central, Ghana',
        customerName: 'Efua Mensah',
        customerPhone: '+233541234567',
        destinationAddress: 'Spintex Road, Accra, Ghana',
        paymentMethod: PaymentMethod.credit_card,
        subtotal: 2800,
        total: 3000,
        earning: 300,
        tip: 50,
        etaMinutes: 25,
        distanceKm: 8.1,
      },
    ],
  });

  const createdOrders = await prisma.order.findMany({
    orderBy: { createdAt: 'asc' },
  });

  for (const order of createdOrders) {
    await prisma.orderItem.createMany({
      data: [
        {
          orderId: order.id,
          name: 'Rice and stew pack',
          price: 1800,
          quantity: 1,
        },
        {
          orderId: order.id,
          name: 'Fresh juice',
          price: 800,
          quantity: 2,
        },
      ],
    });

    await prisma.transaction.createMany({
      data: [
        {
          walletId: (await prisma.wallet.findFirst({
            where: { courierId: order.courierId! },
          }))!.id,
          orderId: order.id,
          type: TransactionType.earning,
          amount: order.earning,
        },
        {
          walletId: (await prisma.wallet.findFirst({
            where: { courierId: order.courierId! },
          }))!.id,
          orderId: order.id,
          type: TransactionType.tip,
          amount: order.tip,
        },
      ],
    });

    await prisma.message.createMany({
      data: [
        {
          orderId: order.id,
          senderType: SenderType.courier,
          senderId: order.courierId ?? undefined,
          content: 'Pickup confirmed and en route.',
        },
        {
          orderId: order.id,
          senderType: SenderType.customer,
          content: 'Please call me when you arrive.',
        },
      ],
    });

    await prisma.notification.createMany({
      data: [
        {
          courierId: order.courierId!,
          type: NotificationType.order,
          title: 'Order assigned',
          body: `New delivery request ${order.orderNumber}`,
        },
        {
          courierId: order.courierId!,
          type: NotificationType.payment,
          title: 'Payment update',
          body: 'Your weekly payout is ready.',
        },
      ],
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
