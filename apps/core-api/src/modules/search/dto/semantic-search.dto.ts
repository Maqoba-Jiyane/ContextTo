import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SemanticSearchDto {
  @IsUUID('4')
  organizationId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  query!: string;

  @IsOptional()
  @IsUUID('4')
  workspaceId?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value ?? 5))
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 5;
}
