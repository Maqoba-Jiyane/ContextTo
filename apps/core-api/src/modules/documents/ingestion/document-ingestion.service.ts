import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  DocumentIngestionStatus,
  Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  DOCUMENT_INGESTION_QUEUE,
  DocumentQueueJobName,
} from '../../queue/queue.constants';
import { CreateDocumentIngestionDto } from './dto/create-document-ingestion.dto';
import {
  EnqueueDocumentIngestionResult,
  IngestDocumentJobPayload,
  IngestDocumentJobResult,
  RequesterContext,
} from './types/document-ingestion.types';

@Injectable()
export class DocumentIngestionService {
  private readonly logger = new Logger(DocumentIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(DOCUMENT_INGESTION_QUEUE)
    private readonly documentIngestionQueue: Queue<
      IngestDocumentJobPayload,
      IngestDocumentJobResult,
      DocumentQueueJobName
    >,
  ) {}

  async enqueueDocumentIngestion(
    payload: CreateDocumentIngestionDto,
    requester: RequesterContext,
  ): Promise<EnqueueDocumentIngestionResult> {
    const filename = this.normalizeFilename(payload.filename);

    await this.assertRequesterBelongsToOrganization({
      userId: requester.userId,
      organizationId: payload.organizationId,
    });

    if (payload.workspaceId) {
      await this.assertWorkspaceBelongsToOrganization({
        workspaceId: payload.workspaceId,
        organizationId: payload.organizationId,
      });
    }

    const document = await this.prisma.document.create({
      data: {
        organizationId: payload.organizationId,
        workspaceId: payload.workspaceId ?? null,
        uploadedByUserId: requester.userId,
        originalFileName: filename,
        storageUrl: payload.storageUrl ?? null,
        mimeType: payload.mimeType ?? null,
        sizeBytes: payload.sizeBytes ?? null,
        checksumSha256: payload.checksumSha256 ?? null,
        ingestionStatus: DocumentIngestionStatus.PENDING,
      },
      select: {
        id: true,
        organizationId: true,
        workspaceId: true,
        uploadedByUserId: true,
        originalFileName: true,
        storageUrl: true,
        mimeType: true,
        sizeBytes: true,
        checksumSha256: true,
        ingestionStatus: true,
      },
    });

    const jobPayload: IngestDocumentJobPayload = {
      documentId: document.id,
      organizationId: document.organizationId,
      workspaceId: document.workspaceId,
      uploadedByUserId: document.uploadedByUserId,
      filename: document.originalFileName,
      storageUrl: document.storageUrl,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      checksumSha256: document.checksumSha256,
      requestedAt: new Date().toISOString(),
    };

    try {
      const queueJob = await this.documentIngestionQueue.add(
        DocumentQueueJobName.INGEST_DOCUMENT,
        jobPayload,
        {
          jobId: this.buildDeterministicJobId(document.id),
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5_000,
          },
          removeOnComplete: {
            age: 86_400,
            count: 1_000,
          },
          removeOnFail: {
            age: 604_800,
            count: 5_000,
          },
        },
      );

      const queueJobId = String(queueJob.id);

      await this.prisma.document.update({
        where: {
          id: document.id,
        },
        data: {
          ingestionJobId: queueJobId,
        },
      });

      return {
        documentId: document.id,
        organizationId: document.organizationId,
        workspaceId: document.workspaceId,
        status: document.ingestionStatus,
        queueJobId,
      };
    } catch (error) {
      const message = this.getSafeErrorMessage(error);

      this.logger.error(
        `Failed to enqueue ingestion job for document ${document.id}: ${message}`,
      );

      await this.prisma.document.update({
        where: {
          id: document.id,
        },
        data: {
          ingestionStatus: DocumentIngestionStatus.FAILED,
          ingestionFailedAt: new Date(),
          ingestionError: message,
        },
      });

      throw new ServiceUnavailableException(
        'Document was saved, but ingestion could not be queued.',
      );
    }
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
        'You do not have permission to upload documents to this organization.',
      );
    }
  }

  private async assertWorkspaceBelongsToOrganization(params: {
    workspaceId: string;
    organizationId: string;
  }): Promise<void> {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: params.workspaceId,
        organizationId: params.organizationId,
      },
      select: {
        id: true,
        archivedAt: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException(
        'Workspace was not found in the selected organization.',
      );
    }

    if (workspace.archivedAt) {
      throw new BadRequestException(
        'Cannot upload documents into an archived workspace.',
      );
    }
  }

  private normalizeFilename(filename: string): string {
    const trimmedFilename = filename.trim();

    if (!trimmedFilename) {
      throw new BadRequestException('Filename is required.');
    }

    if (trimmedFilename.includes('/') || trimmedFilename.includes('\\')) {
      throw new BadRequestException('Filename must not contain path separators.');
    }

    if (trimmedFilename === '.' || trimmedFilename === '..') {
      throw new BadRequestException('Filename is invalid.');
    }

    return trimmedFilename;
  }

  private buildDeterministicJobId(documentId: string): string {
    return `document:${documentId}:ingestion`;
  }

  private getSafeErrorMessage(error: unknown): string {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return `Database error ${error.code}`;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown queue error';
  }
}
