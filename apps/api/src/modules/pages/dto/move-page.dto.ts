import { IsOptional, IsUUID, IsNumber } from 'class-validator';

export class MovePageDto {
  @IsOptional()
  @IsUUID()
  targetChapterId?: string;

  @IsOptional()
  @IsUUID()
  targetBookId?: string;

  @IsNumber()
  priority: number;
}
