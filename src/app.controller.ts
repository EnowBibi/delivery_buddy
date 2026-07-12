import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller()
export class AppController {
  @Get()
  @ApiExcludeEndpoint()
  apiRoot() {
    return {
      status: 'ok',
      message: 'Delivery Buddy API is running',
    };
  }

  @Get('health')
  @ApiExcludeEndpoint()
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
