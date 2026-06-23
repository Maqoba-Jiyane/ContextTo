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

export class AskQuestionDto {
  @IsUUID('4')
  organizationId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  question!: string;

  @IsOptional()
  @IsUUID('4')
  workspaceId?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value ?? 5))
  @IsInt()
  @Min(1)
  @Max(10)
  limit = 5;
}
