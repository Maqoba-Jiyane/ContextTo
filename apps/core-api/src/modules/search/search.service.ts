import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SemanticSearchDto } from './dto/semantic-search.dto';

interface RequesterContext {
  userId: string;
}

interface AiEmbedQueryResponse {
  embedding: number[];
  dimensions: number;
}

interface SemanticSearchRawRow {
  chunkId: string;
  documentId: string;
  organizationId: string;
  workspaceId: string | null;
  originalFileName: string;
  chunkIndex: number;
  content: string;
  tokenCount: number | null;
  cosineDistance: number;
  score: number;
}

export interface SemanticSearchMatch {
  chunkId: string;
  documentId: string;
  organizationId: string;
  workspaceId: string | null;
  originalFileName: string;
  chunkIndex: number;
  content: string;
  tokenCount: number | null;
  cosineDistance: number;
  score: number;
}

export interface SemanticSearchResponse {
  query: string;
  organizationId: string;
  matches: SemanticSearchMatch[];
}

@Injectable()
export class SearchService {
  private async searchWithinDocument(params: {
    organizationId: string;
    documentId: string;
    vectorLiteral: string;
    limit: number;
  }): Promise<SemanticSearchRawRow[]> {
    return this.prisma.$queryRaw<SemanticSearchRawRow[]>`
    SELECT
      dc."id"::text AS "chunkId",
      dc."document_id"::text AS "documentId",
      dc."organization_id"::text AS "organizationId",
      d."workspace_id"::text AS "workspaceId",
      d."original_file_name" AS "originalFileName",
      dc."chunk_index" AS "chunkIndex",
      dc."content",
      dc."token_count" AS "tokenCount",
      (dc."embedding" <=> ${params.vectorLiteral}::vector) AS "cosineDistance",
      (1 - (dc."embedding" <=> ${params.vectorLiteral}::vector)) AS "score"
    FROM "document_chunks" dc
    INNER JOIN "documents" d
      ON d."id" = dc."document_id"
    WHERE dc."organization_id" = ${params.organizationId}::uuid
      AND dc."document_id" = ${params.documentId}::uuid
      AND dc."embedding" IS NOT NULL
      AND d."deleted_at" IS NULL
    ORDER BY dc."embedding" <=> ${params.vectorLiteral}::vector
    LIMIT ${params.limit};
  `;
  }

  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async semanticSearch(
    payload: SemanticSearchDto,
    requester: RequesterContext,
  ): Promise<SemanticSearchResponse> {
    await this.assertRequesterBelongsToOrganization({
      userId: requester.userId,
      organizationId: payload.organizationId,
    });

    const embedding = await this.embedQuery(payload.query);
    const vectorLiteral = this.toPgVector(embedding);

    const rows = payload.documentId
      ? await this.searchWithinDocument({
          organizationId: payload.organizationId,
          documentId: payload.documentId,
          vectorLiteral,
          limit: payload.limit,
        })
      : payload.workspaceId
        ? await this.searchWithinWorkspace({
            organizationId: payload.organizationId,
            workspaceId: payload.workspaceId,
            vectorLiteral,
            limit: payload.limit,
          })
        : await this.searchWithinOrganization({
            organizationId: payload.organizationId,
            vectorLiteral,
            limit: payload.limit,
          });

    return {
      query: payload.query,
      organizationId: payload.organizationId,
      matches: rows.map((row) => ({
        chunkId: row.chunkId,
        documentId: row.documentId,
        organizationId: row.organizationId,
        workspaceId: row.workspaceId,
        originalFileName: row.originalFileName,
        chunkIndex: row.chunkIndex,
        content: row.content,
        tokenCount: row.tokenCount,
        cosineDistance: Number(row.cosineDistance),
        score: Number(row.score),
      })),
    };
  }

  private async searchWithinOrganization(params: {
    organizationId: string;
    vectorLiteral: string;
    limit: number;
  }): Promise<SemanticSearchRawRow[]> {
    return this.prisma.$queryRaw<SemanticSearchRawRow[]>`
      SELECT
        dc."id"::text AS "chunkId",
        dc."document_id"::text AS "documentId",
        dc."organization_id"::text AS "organizationId",
        d."workspace_id"::text AS "workspaceId",
        d."original_file_name" AS "originalFileName",
        dc."chunk_index" AS "chunkIndex",
        dc."content",
        dc."token_count" AS "tokenCount",
        (dc."embedding" <=> ${params.vectorLiteral}::vector) AS "cosineDistance",
        (1 - (dc."embedding" <=> ${params.vectorLiteral}::vector)) AS "score"
      FROM "document_chunks" dc
      INNER JOIN "documents" d
        ON d."id" = dc."document_id"
      WHERE dc."organization_id" = ${params.organizationId}::uuid
        AND dc."embedding" IS NOT NULL
        AND d."deleted_at" IS NULL
      ORDER BY dc."embedding" <=> ${params.vectorLiteral}::vector
      LIMIT ${params.limit};
    `;
  }

  private async searchWithinWorkspace(params: {
    organizationId: string;
    workspaceId: string;
    vectorLiteral: string;
    limit: number;
  }): Promise<SemanticSearchRawRow[]> {
    return this.prisma.$queryRaw<SemanticSearchRawRow[]>`
      SELECT
        dc."id"::text AS "chunkId",
        dc."document_id"::text AS "documentId",
        dc."organization_id"::text AS "organizationId",
        d."workspace_id"::text AS "workspaceId",
        d."original_file_name" AS "originalFileName",
        dc."chunk_index" AS "chunkIndex",
        dc."content",
        dc."token_count" AS "tokenCount",
        (dc."embedding" <=> ${params.vectorLiteral}::vector) AS "cosineDistance",
        (1 - (dc."embedding" <=> ${params.vectorLiteral}::vector)) AS "score"
      FROM "document_chunks" dc
      INNER JOIN "documents" d
        ON d."id" = dc."document_id"
      WHERE dc."organization_id" = ${params.organizationId}::uuid
        AND d."workspace_id" = ${params.workspaceId}::uuid
        AND dc."embedding" IS NOT NULL
        AND d."deleted_at" IS NULL
      ORDER BY dc."embedding" <=> ${params.vectorLiteral}::vector
      LIMIT ${params.limit};
    `;
  }

  private async embedQuery(query: string): Promise<number[]> {
    const aiServiceUrl =
      this.configService.getOrThrow<string>('AI_SERVICE_URL');

    let response: Response;

    try {
      response = await fetch(`${aiServiceUrl}/embed/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
    } catch (error) {
      this.logger.error(
        `Failed to reach AI service: ${this.getErrorMessage(error)}`,
      );

      throw new ServiceUnavailableException(
        'AI service is unavailable. Could not embed query.',
      );
    }

    if (!response.ok) {
      const errorBody = await response.text();

      throw new ServiceUnavailableException(
        `AI service failed to embed query. Status ${response.status}: ${errorBody}`,
      );
    }

    const data = (await response.json()) as AiEmbedQueryResponse;

    if (!Array.isArray(data.embedding)) {
      throw new ServiceUnavailableException(
        'AI service returned an invalid embedding response.',
      );
    }

    if (data.dimensions !== 384 || data.embedding.length !== 384) {
      throw new ServiceUnavailableException(
        `Expected embedding dimension 384, received ${data.dimensions}.`,
      );
    }

    return data.embedding;
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

  private toPgVector(embedding: number[]): string {
    if (!Array.isArray(embedding)) {
      throw new BadRequestException('Embedding must be an array.');
    }

    if (embedding.length !== 384) {
      throw new BadRequestException(
        `Expected embedding dimension 384, received ${embedding.length}.`,
      );
    }

    for (const value of embedding) {
      if (!Number.isFinite(value)) {
        throw new BadRequestException(
          'Embedding contains a non-finite number.',
        );
      }
    }

    return `[${embedding.join(',')}]`;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return `Database error ${error.code}`;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }
}
