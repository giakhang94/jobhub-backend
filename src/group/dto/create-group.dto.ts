import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { GroupPrivacy } from '../../../generated/prisma/enums.js';

export class CreateGroupDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(GroupPrivacy)
  privacy?: GroupPrivacy;

  @IsOptional()
  requireApprove!: boolean;
}
