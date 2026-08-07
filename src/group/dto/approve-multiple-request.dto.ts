import { IsArray, IsInt, ArrayNotEmpty } from 'class-validator';

export class ApproveMultipleDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  targetUserIds!: number[];
}
