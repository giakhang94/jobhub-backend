import { GroupRole } from '../../../generated/prisma/enums.js';

export class UpdateMemberPermissionsDto {
  role?: GroupRole; // GroupRole.MODERATOR hoặc GroupRole.MEMBER
  canApproveMember?: boolean;
  canDeletePost?: boolean;
  canApprovePost?: boolean;
  canPinPost?: boolean;
  canKickMember?: boolean;
}
