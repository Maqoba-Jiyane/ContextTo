import { Module } from '@nestjs/common';
import { DocumentIngestionModule } from './ingestion/document-ingestion.module';
import { DocumentIngestionProcessor } from './workers/document-ingestion.processor';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [DocumentIngestionModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentIngestionProcessor],
  exports: [DocumentsService, DocumentIngestionModule],
})
export class DocumentsModule {}
