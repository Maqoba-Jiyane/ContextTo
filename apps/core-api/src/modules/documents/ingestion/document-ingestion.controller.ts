import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UploadedFile,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { CreateDocumentIngestionDto } from './dto/create-document-ingestion.dto';
import { DocumentIngestionService } from './document-ingestion.service';
import { EnqueueDocumentIngestionResult } from './types/document-ingestion.types';

interface UploadDocumentBody {
  organizationId?: string;
  workspaceId?: string;
}

@Controller('documents/ingestion')
export class DocumentIngestionController {
  constructor(
    private readonly documentIngestionService: DocumentIngestionService,
  ) {}

  @Post()
  async create(
    @Body() body: CreateDocumentIngestionDto,
    @Headers('x-user-id') userId: string | undefined,
  ): Promise<EnqueueDocumentIngestionResult> {
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user context.');
    }

    if (!this.isUuid(userId)) {
      throw new BadRequestException('x-user-id must be a valid UUID.');
    }

    return this.documentIngestionService.enqueueDocumentIngestion(body, {
      userId,
    });
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: 'uploads/documents',
        filename: (_request, file, callback) => {
          const fileExtension = extname(file.originalname);
          const safeFilename = `${randomUUID()}${fileExtension}`;

          callback(null, safeFilename);
        },
      }),
      limits: {
        fileSize: 25 * 1024 * 1024,
      },
      fileFilter: (_request, file, callback) => {
        const allowedMimeTypes = new Set([
          'application/pdf',
          'text/plain',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ]);

        if (!allowedMimeTypes.has(file.mimetype)) {
          callback(
            new BadRequestException(
              'Only PDF, TXT, DOC, and DOCX files are allowed.',
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadDocumentBody,
    @Headers('x-user-id') userId: string | undefined,
  ): Promise<EnqueueDocumentIngestionResult> {
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user context.');
    }

    if (!this.isUuid(userId)) {
      throw new BadRequestException('x-user-id must be a valid UUID.');
    }

    if (!file) {
      throw new BadRequestException('File is required.');
    }

    if (!body.organizationId || !this.isUuid(body.organizationId)) {
      throw new BadRequestException('organizationId must be a valid UUID.');
    }

    if (body.workspaceId && !this.isUuid(body.workspaceId)) {
      throw new BadRequestException('workspaceId must be a valid UUID.');
    }

    return this.documentIngestionService.enqueueDocumentIngestion(
      {
        filename: file.originalname,
        organizationId: body.organizationId,
        workspaceId: body.workspaceId,
        storageUrl: `/uploads/documents/${file.filename}`,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
      {
        userId,
      },
    );
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
