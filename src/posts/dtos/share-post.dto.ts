import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Privacy } from '../../../generated/prisma/enums.js';

export class SharePostDto {
  @IsOptional()
  @IsString()
  content!: string;

  @IsOptional()
  @IsEnum(Privacy)
  privacy?: Privacy;
}
