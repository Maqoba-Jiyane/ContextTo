import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDocumentIngestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(260)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  filename!: string;

  @IsUUID('4')
  organizationId!: string;

  @IsOptional()
  @IsUUID('4')
  workspaceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  storageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i, {
    message: 'checksumSha256 must be a valid SHA-256 hex string',
  })
  checksumSha256?: string;
}
