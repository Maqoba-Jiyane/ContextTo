import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  DocumentIngestionStatus,
  Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  DOCUMENT_INGESTION_QUEUE,
  DocumentQueueJobName,
} from '../../queue/queue.constants';
import {
  IngestDocumentJobPayload,
  IngestDocumentJobResult,
} from '../ingestion/types/document-ingestion.types';
import { randomUUID } from 'node:crypto';

interface AiExtractedChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embedding: number[];
  metadata: Prisma.InputJsonValue;
}

interface AiExtractedChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: Prisma.InputJsonValue;
}

interface AiIngestDocumentResponse {
  documentId: string;
  organizationId: string;
  status: 'COMPLETED' | 'FAILED';
  chunksCreated: number;
  chunks: AiExtractedChunk[];
}

@Injectable()
@Processor(DOCUMENT_INGESTION_QUEUE)
export class DocumentIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentIngestionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  private toPgVector(embedding: number[]): string {
    if (!Array.isArray(embedding)) {
      throw new Error('Embedding must be an array.');
    }

    if (embedding.length !== 384) {
      throw new Error(
        `Expected embedding dimension 384, received ${embedding.length}.`,
      );
    }

    for (const value of embedding) {
      if (!Number.isFinite(value)) {
        throw new Error('Embedding contains a non-finite number.');
      }
    }

    return `[${embedding.join(',')}]`;
  }

  async process(
    job: Job<
      IngestDocumentJobPayload,
      IngestDocumentJobResult,
      DocumentQueueJobName
    >,
  ): Promise<IngestDocumentJobResult> {
    this.logger.log(
      `Processing job ${job.id} for document ${job.data.documentId}`,
    );

    await this.markDocumentAsProcessing(job.data.documentId);

    try {
      const aiResponse = await this.callAiIngestionService(job.data);

      if (aiResponse.status !== 'COMPLETED') {
        throw new Error(
          'AI service returned a non-completed ingestion status.',
        );
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.documentChunk.deleteMany({
          where: {
            documentId: job.data.documentId,
          },
        });

        for (const chunk of aiResponse.chunks) {
          const chunkId = randomUUID();
          const vectorLiteral = this.toPgVector(chunk.embedding);
          const metadataJson = JSON.stringify(chunk.metadata ?? {});

          await tx.$executeRaw`
      INSERT INTO "document_chunks" (
        "id",
        "organization_id",
        "document_id",
        "chunk_index",
        "content",
        "token_count",
        "metadata",
        "embedding",
        "created_at"
      )
      VALUES (
        ${chunkId}::uuid,
        ${job.data.organizationId}::uuid,
        ${job.data.documentId}::uuid,
        ${chunk.chunkIndex},
        ${chunk.content},
        ${chunk.tokenCount},
        ${metadataJson}::jsonb,
        ${vectorLiteral}::vector,
        NOW()
      )
    `;
        }

        await tx.document.update({
          where: {
            id: job.data.documentId,
          },
          data: {
            ingestionStatus: DocumentIngestionStatus.COMPLETED,
            ingestionCompletedAt: new Date(),
            ingestionError: null,
          },
        });
      });

      this.logger.log(
        `Document ${job.data.documentId} completed. Chunks created: ${aiResponse.chunksCreated}`,
      );

      return {
        documentId: job.data.documentId,
        organizationId: job.data.organizationId,
        status: DocumentIngestionStatus.COMPLETED,
        chunksCreated: aiResponse.chunksCreated,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      const message = this.getSafeErrorMessage(error);

      this.logger.error(
        `Document ${job.data.documentId} failed during ingestion: ${message}`,
      );

      await this.prisma.document.update({
        where: {
          id: job.data.documentId,
        },
        data: {
          ingestionStatus: DocumentIngestionStatus.FAILED,
          ingestionFailedAt: new Date(),
          ingestionError: message,
        },
      });

      throw error;
    }
  }

  private async markDocumentAsProcessing(documentId: string): Promise<void> {
    await this.prisma.document.update({
      where: {
        id: documentId,
      },
      data: {
        ingestionStatus: DocumentIngestionStatus.PROCESSING,
        ingestionStartedAt: new Date(),
        ingestionError: null,
      },
    });
  }

  private async callAiIngestionService(
    payload: IngestDocumentJobPayload,
  ): Promise<AiIngestDocumentResponse> {
    const aiServiceUrl =
      this.configService.getOrThrow<string>('AI_SERVICE_URL');

    const response = await fetch(`${aiServiceUrl}/ingest/document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      throw new Error(
        `AI service failed with status ${response.status}: ${errorBody}`,
      );
    }

    const data = (await response.json()) as AiIngestDocumentResponse;

    if (!data.documentId || !data.organizationId || !data.status) {
      throw new Error('AI service returned an invalid ingestion response.');
    }

    return data;
  }

  private getSafeErrorMessage(error: unknown): string {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return `Database error ${error.code}`;
    }

    if (error instanceof Error) {
      const cause = error.cause;

      if (cause instanceof Error) {
        return `${error.message}: ${cause.message}`;
      }

      return error.message;
    }

    return 'Unknown document ingestion worker error';
  }
}
