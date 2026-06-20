import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentIngestionStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { ListDocumentChunksDto } from './dto/list-document-chunks.dto';

export interface DocumentChunkListItem {
  id: string;
  organizationId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number | null;
  metadata: unknown;
  createdAt: Date;
}

export interface PaginatedDocumentChunksResponse {
  data: DocumentChunkListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface RequesterContext {
  userId: string;
}

export interface DocumentListItem {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  originalFileName: string;
  storageUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  ingestionStatus: DocumentIngestionStatus;
  ingestionJobId: string | null;
  ingestionStartedAt: Date | null;
  ingestionCompletedAt: Date | null;
  ingestionFailedAt: Date | null;
  ingestionError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedDocumentsResponse {
  data: DocumentListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listDocumentChunks(params: {
    documentId: string;
    query: ListDocumentChunksDto;
    requester: RequesterContext;
  }): Promise<PaginatedDocumentChunksResponse> {
    await this.assertRequesterBelongsToOrganization({
      userId: params.requester.userId,
      organizationId: params.query.organizationId,
    });

    const document = await this.prisma.document.findFirst({
      where: {
        id: params.documentId,
        organizationId: params.query.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document was not found.');
    }

    const page = params.query.page;
    const limit = params.query.limit;
    const skip = (page - 1) * limit;

    const where: Prisma.DocumentChunkWhereInput = {
      documentId: params.documentId,
      organizationId: params.query.organizationId,
    };

    const [chunks, total] = await this.prisma.$transaction([
      this.prisma.documentChunk.findMany({
        where,
        orderBy: {
          chunkIndex: 'asc',
        },
        skip,
        take: limit,
        select: {
          id: true,
          organizationId: true,
          documentId: true,
          chunkIndex: true,
          content: true,
          tokenCount: true,
          metadata: true,
          createdAt: true,
        },
      }),

      this.prisma.documentChunk.count({
        where,
      }),
    ]);

    return {
      data: chunks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listDocuments(
    query: ListDocumentsDto,
    requester: RequesterContext,
  ): Promise<PaginatedDocumentsResponse> {
    await this.assertRequesterBelongsToOrganization({
      userId: requester.userId,
      organizationId: query.organizationId,
    });

    if (query.workspaceId) {
      await this.assertWorkspaceBelongsToOrganization({
        organizationId: query.organizationId,
        workspaceId: query.workspaceId,
      });
    }

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const where: Prisma.DocumentWhereInput = {
      organizationId: query.organizationId,
      deletedAt: null,
      ...(query.workspaceId ? { workspaceId: query.workspaceId } : {}),
      ...(query.status ? { ingestionStatus: query.status } : {}),
    };

    const [documents, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        select: {
          id: true,
          organizationId: true,
          workspaceId: true,
          originalFileName: true,
          storageUrl: true,
          mimeType: true,
          sizeBytes: true,
          ingestionStatus: true,
          ingestionJobId: true,
          ingestionStartedAt: true,
          ingestionCompletedAt: true,
          ingestionFailedAt: true,
          ingestionError: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.document.count({
        where,
      }),
    ]);

    return {
      data: documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDocumentById(params: {
    documentId: string;
    organizationId: string;
    requester: RequesterContext;
  }): Promise<DocumentListItem> {
    await this.assertRequesterBelongsToOrganization({
      userId: params.requester.userId,
      organizationId: params.organizationId,
    });

    const document = await this.prisma.document.findFirst({
      where: {
        id: params.documentId,
        organizationId: params.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        workspaceId: true,
        originalFileName: true,
        storageUrl: true,
        mimeType: true,
        sizeBytes: true,
        ingestionStatus: true,
        ingestionJobId: true,
        ingestionStartedAt: true,
        ingestionCompletedAt: true,
        ingestionFailedAt: true,
        ingestionError: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document was not found.');
    }

    return document;
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
      },
    });

    if (!workspace) {
      throw new NotFoundException(
        'Workspace was not found in the selected organization.',
      );
    }
  }
}
