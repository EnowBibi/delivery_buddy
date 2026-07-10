import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ShiftsService } from './shifts.service';
import { ListShiftsDto } from './dto/list-shifts.dto';

@ApiTags('shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start a new shift' })
  start(@CurrentUser() user: AuthenticatedUser) {
    return this.shiftsService.start(user.id);
  }

  @Post('stop')
  @ApiOperation({ summary: "Stop the courier's active shift" })
  stop(@CurrentUser() user: AuthenticatedUser) {
    return this.shiftsService.stop(user.id);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get the active shift live stats' })
  findCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.shiftsService.findCurrent(user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List past shifts (supports ?last=1)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListShiftsDto,
  ) {
    return this.shiftsService.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific shift by ID' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.shiftsService.findOne(user.id, id);
  }
}
