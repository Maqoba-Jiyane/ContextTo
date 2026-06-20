import { Transform } from 'class-transformer';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class ListDocumentChunksDto {
  @IsUUID('4')
  organizationId!: string;

  @Transform(({ value }) => Number(value ?? 1))
  @IsInt()
  @Min(1)
  page = 1;

  @Transform(({ value }) => Number(value ?? 20))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
