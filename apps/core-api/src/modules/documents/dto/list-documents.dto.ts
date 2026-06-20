import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { DocumentIngestionStatus } from '../../../generated/prisma/client';

export class ListDocumentsDto {
  @IsUUID('4')
  organizationId!: string;

  @IsOptional()
  @IsUUID('4')
  workspaceId?: string;

  @IsOptional()
  @IsEnum(DocumentIngestionStatus)
  status?: DocumentIngestionStatus;

  @IsOptional()
  @Transform(({ value }) => Number(value ?? 1))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value ?? 20))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
