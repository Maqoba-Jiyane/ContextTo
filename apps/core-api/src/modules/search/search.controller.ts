import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  SearchService,
  SemanticSearchResponse,
} from './search.service';
import { SemanticSearchDto } from './dto/semantic-search.dto';

@Controller('semantic-search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  async semanticSearch(
    @Body() body: SemanticSearchDto,
    @Headers('x-user-id') userId: string | undefined,
  ): Promise<SemanticSearchResponse> {
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user context.');
    }

    if (!this.isUuid(userId)) {
      throw new BadRequestException('x-user-id must be a valid UUID.');
    }

    return this.searchService.semanticSearch(body, {
      userId,
    });
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
