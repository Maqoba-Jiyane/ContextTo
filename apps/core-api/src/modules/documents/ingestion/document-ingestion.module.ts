import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../../database/prisma.module';
import { QueueModule } from '../../queue/queue.module';
import { DOCUMENT_INGESTION_QUEUE } from '../../queue/queue.constants';
import { DocumentIngestionController } from './document-ingestion.controller';
import { DocumentIngestionService } from './document-ingestion.service';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    BullModule.registerQueue({
      name: DOCUMENT_INGESTION_QUEUE,
    }),
  ],
  controllers: [DocumentIngestionController],
  providers: [DocumentIngestionService],
  exports: [DocumentIngestionService],
})
export class DocumentIngestionModule {}
