import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const result = await this.prisma.$queryRaw<{ now: Date }[]>`
      SELECT NOW() as now
    `;

    return {
      service: 'core-api',
      status: 'ok',
      database: 'connected',
      timestamp: result[0]?.now,
    };
  }
}
