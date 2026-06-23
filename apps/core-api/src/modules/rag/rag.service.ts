import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchService, SemanticSearchMatch } from '../search/search.service';
import { AskQuestionDto } from './dto/ask-question.dto';
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface RequesterContext {
  userId: string;
}

interface AiAnswerCitation {
  chunkId: string;
  documentId: string;
  originalFileName: string;
  chunkIndex: number;
  score: number;
}

interface AiAnswerResponse {
  answer: string;
  citations: AiAnswerCitation[];
}

export interface RagCitation {
  chunkId: string;
  documentId: string;
  originalFileName: string;
  chunkIndex: number;
  score: number;
}

export interface RagAnswerResponse {
  historyId: string | null;
  question: string;
  answer: string;
  citations: RagCitation[];
  retrievedChunks: SemanticSearchMatch[];
}

export interface RagHistoryItem {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  askedByUserId: string;
  question: string;
  answer: string;
  citations: unknown;
  retrievedChunks: unknown;
  createdAt: string;
}

export interface RagHistoryResponse {
  items: RagHistoryItem[];
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async listHistory(params: {
    organizationId: string;
    workspaceId?: string;
    userId: string;
    limit?: number;
  }): Promise<RagHistoryResponse> {
    await this.assertRequesterBelongsToOrganization({
      userId: params.userId,
      organizationId: params.organizationId,
    });

    const logs = await this.prisma.ragAskLog.findMany({
      where: {
        organizationId: params.organizationId,
        ...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: params.limit ?? 20,
    });

    return {
      items: logs.map((log) => ({
        id: log.id,
        organizationId: log.organizationId,
        workspaceId: log.workspaceId,
        askedByUserId: log.askedByUserId,
        question: log.question,
        answer: log.answer,
        citations: log.citations,
        retrievedChunks: log.retrievedChunks,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  private async assertRequesterBelongsToOrganization(params: {
    userId: string;
    organizationId: string;
  }): Promise<void> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: params.organizationId,
          userId: params.userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organization.',
      );
    }
  }

  async askQuestion(
    payload: AskQuestionDto,
    requester: RequesterContext,
  ): Promise<RagAnswerResponse> {
    const searchResponse = await this.searchService.semanticSearch(
      {
        organizationId: payload.organizationId,
        workspaceId: payload.workspaceId,
        query: payload.question,
        limit: payload.limit,
      },
      requester,
    );

    if (searchResponse.matches.length === 0) {
      const answer =
        'I could not find relevant information in the uploaded documents.';

      const historyId = await this.saveAskLog({
        organizationId: payload.organizationId,
        workspaceId: payload.workspaceId,
        askedByUserId: requester.userId,
        question: payload.question,
        answer,
        citations: [],
        retrievedChunks: [],
      });

      return {
        historyId,
        question: payload.question,
        answer,
        citations: [],
        retrievedChunks: [],
      };
    }

    const aiResponse = await this.generateAnswer({
      question: payload.question,
      matches: searchResponse.matches,
    });

    const historyId = await this.saveAskLog({
      organizationId: payload.organizationId,
      workspaceId: payload.workspaceId,
      askedByUserId: requester.userId,
      question: payload.question,
      answer: aiResponse.answer,
      citations: aiResponse.citations,
      retrievedChunks: searchResponse.matches,
    });

    return {
      historyId,
      question: payload.question,
      answer: aiResponse.answer,
      citations: aiResponse.citations,
      retrievedChunks: searchResponse.matches,
    };
  }

  private async saveAskLog(params: {
    organizationId: string;
    workspaceId?: string;
    askedByUserId: string;
    question: string;
    answer: string;
    citations: RagCitation[];
    retrievedChunks: SemanticSearchMatch[];
  }): Promise<string> {
    const log = await this.prisma.ragAskLog.create({
      data: {
        organizationId: params.organizationId,
        workspaceId: params.workspaceId,
        askedByUserId: params.askedByUserId,
        question: params.question,
        answer: params.answer,
        citations: this.toPrismaJson(params.citations),
        retrievedChunks: this.toPrismaJson(
          params.retrievedChunks.map((chunk) => ({
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            originalFileName: chunk.originalFileName,
            chunkIndex: chunk.chunkIndex,
            score: chunk.score,
            cosineDistance: chunk.cosineDistance,
            contentPreview: chunk.content.slice(0, 1200),
          })),
        ),
      },
      select: {
        id: true,
      },
    });

    return log.id;
  }

  private toPrismaJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }

  private async generateAnswer(params: {
    question: string;
    matches: SemanticSearchMatch[];
  }): Promise<AiAnswerResponse> {
    const aiServiceUrl =
      this.configService.getOrThrow<string>('AI_SERVICE_URL');

    let response: Response;

    try {
      response = await fetch(`${aiServiceUrl}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: params.question,
          contexts: params.matches.map((match) => ({
            chunkId: match.chunkId,
            documentId: match.documentId,
            originalFileName: match.originalFileName,
            chunkIndex: match.chunkIndex,
            content: match.content,
            score: match.score,
          })),
        }),
      });
    } catch (error) {
      this.logger.error(
        `Failed to reach AI answer service: ${this.getErrorMessage(error)}`,
      );

      throw new ServiceUnavailableException(
        'AI service is unavailable. Could not generate answer.',
      );
    }

    if (!response.ok) {
      const errorBody = await response.text();

      throw new ServiceUnavailableException(
        `AI service failed to generate answer. Status ${response.status}: ${errorBody}`,
      );
    }

    const data = (await response.json()) as AiAnswerResponse;

    if (!data.answer || !Array.isArray(data.citations)) {
      throw new BadRequestException(
        'AI service returned an invalid answer response.',
      );
    }

    return data;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }
}
