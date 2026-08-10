import { IsEnum, IsOptional } from 'class-validator';
import { GroupRole } from '../../../generated/prisma/enums.js';

export class UpdateMemberPermissionsDto {
  @IsOptional()
  @IsEnum(GroupRole, { message: 'invalid role' })
  role?: GroupRole; // GroupRole.MODERATOR hoặc GroupRole.MEMBER
  @IsOptional()
  canApproveMember?: boolean;
  @IsOptional()
  canDeletePost?: boolean;
  @IsOptional()
  canApprovePost?: boolean;
  @IsOptional()
  canPinPost?: boolean;
  @IsOptional()
  canKickMember?: boolean;
}
