import { IsOptional, IsString } from 'class-validator';

export class AutoSaveDto {
  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsOptional()
  @IsString()
  contentMarkdown?: string;
}
