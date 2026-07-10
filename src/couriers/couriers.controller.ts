import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CouriersService } from './couriers.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('couriers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('couriers')
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  @Post('profile')
  @ApiOperation({ summary: 'Submit onboarding Step 2 profile info' })
  completeProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteProfileDto,
  ) {
    return this.couriersService.completeProfile(user.id, dto);
  }

  @Get('me')
  @ApiOperation({ summary: "Get the authenticated courier's profile" })
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.couriersService.findMe(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update editable profile fields' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.couriersService.update(user.id, dto);
  }
}
