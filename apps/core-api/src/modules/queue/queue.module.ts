import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisTls = configService.get<string>('REDIS_TLS') === 'true';

        return {
          connection: {
            host: configService.getOrThrow<string>('REDIS_HOST'),
            port: Number(configService.getOrThrow<string>('REDIS_PORT')),
            username: configService.get<string>('REDIS_USERNAME') || undefined,
            password: configService.get<string>('REDIS_PASSWORD') || undefined,
            tls: redisTls ? {} : undefined,
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
