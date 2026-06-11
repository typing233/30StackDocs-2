import { IsString, IsOptional, MaxLength, IsInt } from 'class-validator';

export class UpdateChapterDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsInt()
  version: number;
}
