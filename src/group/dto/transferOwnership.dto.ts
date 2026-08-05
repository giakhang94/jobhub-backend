import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { GroupRole } from '../../../generated/prisma/enums.js';

export class TransferOwnershipDto {
  @IsOptional()
  @IsInt()
  ownerForRemoveId?: number;

  @IsOptional()
  @IsEnum(GroupRole)
  ownerNewRole?: GroupRole;

  @IsOptional()
  @IsInt()
  modToBeRemovedId?: number;
}
