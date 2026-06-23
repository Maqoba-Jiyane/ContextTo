import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  imports: [SearchModule],
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
