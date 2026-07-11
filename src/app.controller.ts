import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller()
export class AppController {
  @Get()
  @Version(VERSION_NEUTRAL)
  @ApiExcludeEndpoint()
  root() {
    return {
      status: 'ok',
      message: 'Delivery Buddy API is running',
      docs: '/docs',
      api: '/api/v1',
    };
  }

  @Get('health')
  @ApiExcludeEndpoint()
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
