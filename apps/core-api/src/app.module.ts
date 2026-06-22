import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { HealthController } from './health/health.controller';
import { DocumentsModule } from './modules/documents/documents.module';
import { SearchModule } from './modules/search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
    DocumentsModule,
    SearchModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
