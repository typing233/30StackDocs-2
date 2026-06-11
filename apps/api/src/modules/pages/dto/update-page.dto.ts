import { IsString, IsOptional, MaxLength, IsInt } from 'class-validator';

export class UpdatePageDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsOptional()
  @IsString()
  contentMarkdown?: string;

  @IsInt()
  version: number;
}
