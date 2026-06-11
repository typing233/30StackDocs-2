import { IsArray, IsUUID } from 'class-validator';

export class ReorderChaptersDto {
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
