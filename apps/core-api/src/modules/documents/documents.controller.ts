import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DocumentsService,
  DocumentListItem,
  PaginatedDocumentsResponse,
  PaginatedDocumentChunksResponse,
} from './documents.service';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { ListDocumentChunksDto } from './dto/list-document-chunks.dto';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async listDocuments(
    @Query() query: ListDocumentsDto,
    @Headers('x-user-id') userId: string | undefined,
  ): Promise<PaginatedDocumentsResponse> {
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user context.');
    }

    if (!this.isUuid(userId)) {
      throw new BadRequestException('x-user-id must be a valid UUID.');
    }

    return this.documentsService.listDocuments(query, {
      userId,
    });
  }

  @Get(':documentId/chunks')
  async listDocumentChunks(
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
    @Query() query: ListDocumentChunksDto,
    @Headers('x-user-id') userId: string | undefined,
  ): Promise<PaginatedDocumentChunksResponse> {
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user context.');
    }

    if (!this.isUuid(userId)) {
      throw new BadRequestException('x-user-id must be a valid UUID.');
    }

    return this.documentsService.listDocumentChunks({
      documentId,
      query,
      requester: {
        userId,
      },
    });
  }

  @Get(':documentId')
  async getDocumentById(
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
    @Query('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
    @Headers('x-user-id') userId: string | undefined,
  ): Promise<DocumentListItem> {
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user context.');
    }

    if (!this.isUuid(userId)) {
      throw new BadRequestException('x-user-id must be a valid UUID.');
    }

    return this.documentsService.getDocumentById({
      documentId,
      organizationId,
      requester: {
        userId,
      },
    });
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
