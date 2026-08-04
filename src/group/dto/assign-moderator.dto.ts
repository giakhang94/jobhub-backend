import { IsOptional } from 'class-validator';

export class assignModeratorDto {
  @IsOptional()
  canApproveMember?: Boolean;
  @IsOptional()
  canDeletePost?: Boolean;
  @IsOptional()
  canApprovePost?: Boolean;
  @IsOptional()
  canKickMember?: Boolean;
  @IsOptional()
  canPinPost?: Boolean;
}
