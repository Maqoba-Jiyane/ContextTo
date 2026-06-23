import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Get,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  RagAnswerResponse,
  RagHistoryResponse,
  RagService,
} from './rag.service';
import { AskQuestionDto } from './dto/ask-question.dto';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('ask')
  async askQuestion(
    @Body() body: AskQuestionDto,
    @Headers('x-user-id') userId: string | undefined,
  ): Promise<RagAnswerResponse> {
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user context.');
    }

    if (!this.isUuid(userId)) {
      throw new BadRequestException('x-user-id must be a valid UUID.');
    }

    return this.ragService.askQuestion(body, {
      userId,
    });
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  @Get('history')
  async listHistory(
    @Query('organizationId') organizationId: string,
    @Query('workspaceId') workspaceId: string | undefined,
    @Query('limit') limit: string | undefined,
    @Headers('x-user-id') userId: string | undefined,
  ): Promise<RagHistoryResponse> {
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user context.');
    }

    if (!this.isUuid(userId)) {
      throw new BadRequestException('x-user-id must be a valid UUID.');
    }

    if (!organizationId || !this.isUuid(organizationId)) {
      throw new BadRequestException('organizationId must be a valid UUID.');
    }

    if (workspaceId && !this.isUuid(workspaceId)) {
      throw new BadRequestException('workspaceId must be a valid UUID.');
    }

    return this.ragService.listHistory({
      organizationId,
      workspaceId,
      userId,
      limit: limit ? Number(limit) : 20,
    });
  }
}
