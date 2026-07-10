import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.courier.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // workId is temporary and finalized during onboarding (POST /couriers/profile)
    const workId = `PENDING-${Date.now()}`;

    const courier = await this.prisma.courier.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        workId,
        name: '',
        transportationType: 'bicycle',
      },
    });

    await this.prisma.wallet.create({ data: { courierId: courier.id } });

    return {
      id: courier.id,
      email: courier.email,
      createdAt: courier.createdAt,
    };
  }

  async login(dto: LoginDto) {
    const courier = await this.prisma.courier.findUnique({
      where: { email: dto.email },
    });
    if (!courier) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, courier.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(courier.id, courier.email, courier.workId);
  }

  async logout() {
    // Token invalidation for a stateless JWT setup happens client-side by
    // discarding tokens. If a denylist is required, store the token's jti
    // in Redis with a TTL equal to its remaining lifetime.
    return { message: 'Logged out successfully' };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      return this.issueTokens(payload.sub, payload.email, payload.workId, true);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async issueTokens(
    sub: string,
    email: string,
    workId: string,
    accessOnly = false,
  ) {
    const payload = { sub, email, workId };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
    });

    if (accessOnly) {
      return {
        accessToken,
        expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
      };
    }

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<string>('jwt.refreshExpiresIn'),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
    };
  }
}
