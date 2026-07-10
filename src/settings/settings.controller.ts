import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('fuel-management')
  @ApiOperation({ summary: 'Get fuel management preferences' })
  getFuel(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getField(user.id, 'fuelManagement');
  }

  @Patch('fuel-management')
  @ApiOperation({ summary: 'Update fuel management preferences' })
  updateFuel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.settingsService.updateField(user.id, 'fuelManagement', body);
  }

  @Get('billing-method')
  @ApiOperation({ summary: 'Get billing/payout method' })
  getBilling(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getField(user.id, 'billingMethod');
  }

  @Patch('billing-method')
  @ApiOperation({ summary: 'Update billing/payout method' })
  updateBilling(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.settingsService.updateField(user.id, 'billingMethod', body);
  }

  @Get('location')
  @ApiOperation({ summary: 'Get location-sharing preferences' })
  getLocation(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getField(user.id, 'locationPreferences');
  }

  @Patch('location')
  @ApiOperation({ summary: 'Update location-sharing preferences' })
  updateLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.settingsService.updateField(
      user.id,
      'locationPreferences',
      body,
    );
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get notification preferences' })
  getNotifications(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getField(user.id, 'notificationPreferences');
  }

  @Patch('notifications')
  @ApiOperation({ summary: 'Update notification preferences' })
  updateNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.settingsService.updateField(
      user.id,
      'notificationPreferences',
      body,
    );
  }
}
