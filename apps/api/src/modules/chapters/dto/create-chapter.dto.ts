import { IsString, MaxLength } from 'class-validator';

export class CreateChapterDto {
  @IsString()
  @MaxLength(255)
  name: string;
}
