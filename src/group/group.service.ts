import { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto.js';
import {
  GroupPrivacy,
  GroupRole,
  JoinRequestStatus,
} from '../../generated/prisma/enums.js';

@Injectable()
export class GroupService {
  constructor(private readonly prismaService: PrismaService) {}

  //create a new group
  async createGroup(user: JwtUser, body: CreateGroupDto) {
    const userId = Number(user.id);
    try {
      const result = await this.prismaService.$transaction(async (tx) => {
        //create group
        const newGroup = await tx.group.create({
          data: { createdById: userId, ...body },
        });
        //add the creator to the this new group
        const groupMember = await tx.groupMember.create({
          data: {
            groupId: newGroup.id,
            userId,
            role: GroupRole.OWNER,
          },
        });
        return { newGroup };
      });
      return result;
    } catch (error) {
      console.log('create group error', error);
      throw new InternalServerErrorException(
        'Can not create new group, please try again',
      );
    }
  }

  //join group
  async joinGroup(user: JwtUser, groupId: number) {
    const userId = Number(user.id);
    const group = await this.prismaService.group.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Group not found or was deleted');

    //kiem tra xem user co o trong group chua?
    const UserInGroup = await this.prismaService.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });
    if (UserInGroup) {
      throw new BadRequestException('You are already in  this group');
    }

    //kiem tra xem user co gui request chua?
    const userSentRequest = await this.prismaService.joinRequest.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });
    if (userSentRequest)
      throw new BadRequestException('You have sent join request to this group');

    if (group.privacy === GroupPrivacy.PUBLIC) {
      return this.prismaService.groupMember.create({
        data: { userId, groupId },
      });
    }
    //sau nay update code cho phep gui lai join request o day
    return this.prismaService.joinRequest.create({
      data: { userId, groupId, requestStatus: JoinRequestStatus.PENDING },
    });
  }

  //getGroupById
  async getGroupById(groupId: number) {
    return this.prismaService.group.findUnique({ where: { id: groupId } });
  }

  //leave group
  async leaveGroup(user: JwtUser, groupId: number) {
    const userId = Number(user.id);
    const groupMember = await this.prismaService.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });
    if (!groupMember)
      throw new BadRequestException('You are not in this group');

    if (
      groupMember.role === GroupRole.MEMBER ||
      groupMember.role === GroupRole.MODERATOR
    ) {
      return this.prismaService.groupMember.delete({
        where: {
          userId_groupId: {
            userId,
            groupId,
          },
        },
      });
    }

    if (groupMember.role === GroupRole.OWNER) {
      const ownerCount = await this.prismaService.groupMember.count({
        where: { groupId, role: GroupRole.OWNER },
      });
      if (ownerCount < 2) {
        throw new ForbiddenException(
          'You have to choose a new Owner before leaving this group',
        );
      }
      return this.prismaService.groupMember.delete({
        where: {
          userId_groupId: {
            userId,
            groupId,
          },
        },
      });
    }
  }

  //delete group
  async deleteGroup(user: JwtUser, groupId: number) {
    const userId = Number(user.id);
    const member = await this.prismaService.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });

    if (!member || (member && member.role !== GroupRole.OWNER))
      throw new ForbiddenException('Only the owner can delete this group');

    return this.prismaService.group.delete({ where: { id: groupId } });
  }

  //api for handling join request
  //getPendingRequest
  async getPendingRequest(user: JwtUser, groupId: number) {
    const userId = Number(user.id);
    const groupMember = await this.prismaService.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });
    if (!groupMember) {
      throw new BadRequestException('You are not in this group');
    }
    if (groupMember.role !== GroupRole.OWNER && !groupMember.canApproveMember)
      throw new ForbiddenException('You can not view pending requests');

    return this.prismaService.joinRequest.findMany({
      where: { groupId: groupId, requestStatus: JoinRequestStatus.PENDING },
      include: { user: { select: { id: true, fullname: true, avatar: true } } },
    });
  }

  //approve request
  async approveRequest(user: JwtUser, groupId: number, targetUserId: number) {
    const userId = Number(user.id);
    const groupMember = await this.prismaService.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!groupMember) throw new ForbiddenException('You are not in this group');
    if (groupMember.role !== GroupRole.OWNER && !groupMember.canApproveMember) {
      throw new ForbiddenException('You can not approve members');
    }
    //check if the targetUser is already in the group
    const targetUserInGroup = await this.prismaService.groupMember.findUnique({
      where: {
        userId_groupId: { userId: targetUserId, groupId },
      },
    });
    if (targetUserInGroup)
      throw new BadRequestException('This user is already in the group');

    //check if this user really has a pending join request
    const joinRequest = await this.prismaService.joinRequest.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });
    if (
      !joinRequest ||
      joinRequest.requestStatus !== JoinRequestStatus.PENDING
    ) {
      throw new NotFoundException(
        'Join request not found or already processed',
      );
    }
    try {
      const result = await this.prismaService.$transaction(async (tx) => {
        await tx.joinRequest.update({
          where: {
            userId_groupId: {
              userId: targetUserId,
              groupId,
            },
          },
          data: { requestStatus: JoinRequestStatus.APPROVED },
        });

        await tx.groupMember.create({
          data: { userId: targetUserId, groupId },
        });
        return { message: 'approved' };
      });
      return result;
    } catch (error) {
      console.log('approve member error', error);
      throw new InternalServerErrorException(
        'Something went wrong, please try again',
      );
    }
  }
  // reject request
  async rejectRequest(user: JwtUser, groupId: number, targetUserId: number) {
    const userId = Number(user.id);
    const member = await this.prismaService.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (
      !member ||
      (member.role !== GroupRole.OWNER && !member.canApproveMember)
    )
      throw new ForbiddenException(
        'You do not have permission to reject members',
      );

    return this.prismaService.joinRequest.delete({
      where: { userId_groupId: { userId: targetUserId, groupId: groupId } },
    });
  }
  // approve multiple requests (with the same logic, then I use AI for this method)
  async approveMultipleRequests(
    user: JwtUser,
    groupId: number,
    targetUserIds: number[],
  ) {
    const userId = Number(user.id);

    if (!targetUserIds || targetUserIds.length === 0) {
      throw new BadRequestException(
        'Please provide a list of user IDs to approve',
      );
    }

    // 1. Check quyền người duyệt
    const groupMember = await this.prismaService.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });

    if (!groupMember) throw new ForbiddenException('You are not in this group');

    if (groupMember.role !== GroupRole.OWNER && !groupMember.canApproveMember) {
      throw new ForbiddenException('You can not approve members');
    }

    // 2. Tìm tất cả các JoinRequest hợp lệ (trạng thái PENDING và nằm trong danh sách truyền lên)
    const pendingRequests = await this.prismaService.joinRequest.findMany({
      where: {
        groupId,
        userId: { in: targetUserIds },
        requestStatus: JoinRequestStatus.PENDING,
      },
      select: { userId: true },
    });

    if (pendingRequests.length === 0) {
      throw new NotFoundException(
        'No valid pending join requests found for the provided users',
      );
    }

    const validUserIds = pendingRequests.map((req) => req.userId);

    // 3. Thực hiện Transaction hàng loạt bằng updateMany + createMany
    try {
      await this.prismaService.$transaction(async (tx) => {
        // Cập nhật trạng thái PENDING -> APPROVED cho danh sách request
        await tx.joinRequest.updateMany({
          where: {
            groupId,
            userId: { in: validUserIds },
          },
          data: { requestStatus: JoinRequestStatus.APPROVED },
        });

        // Lấy danh sách user ĐÃ CÓ trong group để tránh duplicate key
        const existingMembers = await tx.groupMember.findMany({
          where: {
            groupId,
            userId: { in: validUserIds },
          },
          select: { userId: true },
        });

        const existingUserIds = new Set(existingMembers.map((m) => m.userId));
        const newMemberData = validUserIds
          .filter((id) => !existingUserIds.has(id))
          .map((id) => ({
            userId: id,
            groupId,
            role: GroupRole.MEMBER,
          }));

        // Thêm các user chưa có trong group vào GroupMember
        if (newMemberData.length > 0) {
          await tx.groupMember.createMany({
            data: newMemberData,
            skipDuplicates: true,
          });
        }
      });

      return {
        message: `Successfully approved ${validUserIds.length} users`,
        approvedUserIds: validUserIds,
      };
    } catch (error) {
      console.log('approve multiple error', error);
      throw new InternalServerErrorException('Failed to approve requests');
    }
  }
}
