import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreatePageDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsUUID()
  chapterId?: string;

  @IsUUID()
  bookId: string;

  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsOptional()
  @IsString()
  contentMarkdown?: string;
}
