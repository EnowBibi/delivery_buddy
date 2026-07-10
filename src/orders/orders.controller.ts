import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { ListOrdersDto } from './dto/list-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "List the courier's order queue" })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersDto,
  ) {
    return this.ordersService.findAll(user.id, query);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get the order currently being delivered' })
  findCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.findCurrent(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full order detail' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.findOne(user.id, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(user.id, id, dto);
  }

  @Get(':id/route')
  @ApiOperation({
    summary: 'Get live routing data for the tracking map (Redis-cached)',
  })
  getRoute(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.getRoute(user.id, id);
  }
}
