import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { SupportController } from './support.controller';

@Module({
  controllers: [SettingsController, SupportController],
  providers: [SettingsService],
})
export class SettingsModule {}
