import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SearchService,
  SemanticSearchMatch,
} from '../search/search.service';
import { AskQuestionDto } from './dto/ask-question.dto';

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
  question: string;
  answer: string;
  citations: RagCitation[];
  retrievedChunks: SemanticSearchMatch[];
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly configService: ConfigService,
  ) {}

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
      return {
        question: payload.question,
        answer:
          'I could not find relevant information in the uploaded documents.',
        citations: [],
        retrievedChunks: [],
      };
    }

    const aiResponse = await this.generateAnswer({
      question: payload.question,
      matches: searchResponse.matches,
    });

    return {
      question: payload.question,
      answer: aiResponse.answer,
      citations: aiResponse.citations,
      retrievedChunks: searchResponse.matches,
    };
  }

  private async generateAnswer(params: {
    question: string;
    matches: SemanticSearchMatch[];
  }): Promise<AiAnswerResponse> {
    const aiServiceUrl = this.configService.getOrThrow<string>('AI_SERVICE_URL');

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
