import { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto.js';
import {
  GroupPrivacy,
  GroupRole,
  JoinRequestStatus,
  NotificationType,
} from '../../generated/prisma/enums.js';
import { UpdateMemberPermissionsDto } from './dto/update-member-permission.dto.js';
import { GROUP_CONFIG } from './constants/group.constant.js';
import { NotificationEvents } from '../notification/events/notification.events.js';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class GroupService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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

    //day danh sanh owner va nguoi phe duyet de gui thong thong bao
    const approvers = await this.prismaService.groupMember.findMany({
      where: {
        groupId,
        OR: [{ role: GroupRole.OWNER }, { canApproveMember: true }],
      },
      select: { userId: true },
    });
    const approverIds = approvers.filter((approver) => {
      return approver.userId !== userId;
    });
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
      const newMember = await this.prismaService.groupMember.create({
        data: { userId, groupId },
      });

      //trigger a notification
      if (newMember) {
        const notificationData = approverIds.map(
          (approverId) =>
            new NotificationEvents({
              senderId: userId,
              type: NotificationType.GROUP_JOINED,
              receiverId: approverId.userId,
            }),
        );
        this.eventEmitter.emit('notifications.createMany', notificationData);
      }
      return newMember;
    }

    //sau nay update code cho phep gui lai join request o day
    const newMember = await this.prismaService.joinRequest.create({
      data: { userId, groupId, requestStatus: JoinRequestStatus.PENDING },
    });
    if (newMember) {
      const notificationData = approverIds.map(
        (approverId) =>
          new NotificationEvents({
            senderId: userId,
            type: NotificationType.GROUP_JOIN_REQUEST,
            receiverId: approverId.userId,
          }),
      );
      this.eventEmitter.emit('notifications.createMany', notificationData);
    }
    return newMember;
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
        //delete this joinRequest
        await tx.joinRequest.delete({
          where: { userId_groupId: { userId: targetUserId, groupId } },
        });
        return { message: 'approved' };
      });
      if (result) {
        this.eventEmitter.emit(
          'notification.create',
          new NotificationEvents({
            senderId: userId,
            receiverId: targetUserId,
            type: NotificationType.GROUP_JOIN_REQUEST_APPROVED,
          }),
        );
      }
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

  //kick member
  async kickMember(user: JwtUser, memberId: number, groupId) {
    const userId = Number(user.id);
    if (userId === memberId) {
      throw new ForbiddenException('You can not kick  yourself');
    }
    const userInGroup = await this.prismaService.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });
    if (!userInGroup) {
      throw new ForbiddenException('You are not in this group');
    }
    if (userInGroup.role !== GroupRole.OWNER && !userInGroup.canKickMember) {
      throw new ForbiddenException(
        'You have no permission to kick a group member',
      );
    }
    const member = await this.prismaService.groupMember.findUnique({
      where: { userId_groupId: { userId: memberId, groupId } },
    });

    if (!member) {
      throw new NotFoundException(
        'This user is not in the group or was kicked',
      );
    }
    if (
      userInGroup.role !== GroupRole.OWNER &&
      member.role === GroupRole.MODERATOR
    ) {
      throw new ForbiddenException(
        'Only owner can kick other owner and moderator',
      );
    }
    if (member.role === GroupRole.OWNER) {
      throw new ForbiddenException('Owner can not be kicked');
    }
    const kickedMember = await this.prismaService.groupMember.delete({
      where: {
        userId_groupId: {
          groupId,
          userId: memberId,
        },
      },
    });

    if (kickedMember) {
      this.eventEmitter.emit(
        'notification.create',
        new NotificationEvents({
          senderId: userId,
          receiverId: memberId,
          type: NotificationType.GROUP_KICKED,
          groupId,
        }),
      );
    }

    return kickedMember;
  }

  async updateMemberPermission(
    user: JwtUser,
    targetUserId: number,
    groupId: number,
    body: UpdateMemberPermissionsDto,
  ) {
    const userId = Number(user.id);
    const userInGroup = await this.prismaService.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });

    if (!userInGroup) throw new NotFoundException('You are not in this group');
    if (userInGroup.role !== GroupRole.OWNER) {
      throw new ForbiddenException(
        'Only the Owner can set permission for members',
      );
    }
    const targetUser = await this.prismaService.groupMember.findUnique({
      where: { userId_groupId: { groupId, userId: targetUserId } },
    });
    if (!targetUser)
      throw new NotFoundException('this user is not in this group');

    if (targetUser.role === GroupRole.OWNER)
      throw new ForbiddenException(
        'You can not set permission for other owners',
      );
    if (body.role && body.role === GroupRole.OWNER)
      throw new ForbiddenException(
        "Please transfer owner in the 'transfer owner' tab",
      );
    const moderatorNumber = await this.prismaService.groupMember.count({
      where: { groupId, role: GroupRole.MODERATOR },
    });
    if (
      body.role &&
      body.role === GroupRole.MODERATOR &&
      moderatorNumber === GROUP_CONFIG.MAX_MODERATOR
    ) {
      throw new BadRequestException(
        'the number of Moderators reach the limit. Please remove one to add a new one',
      );
    }

    const updatedMember = await this.prismaService.groupMember.update({
      where: {
        userId_groupId: {
          userId: targetUserId,
          groupId,
        },
      },
      data: body,
    });

    // 💥 TRIGGER NOTIFICATION: Báo cho targetUser biết quyền hạn đã được thay đổi
    if (userId !== targetUserId) {
      this.eventEmitter.emit(
        'notification.create',
        new NotificationEvents({
          senderId: userId,
          receiverId: targetUserId,
          type: NotificationType.GROUP_PERMISSION_UPDATED,
        }),
      );
    }

    return updatedMember;
  }

  // transfer role (develop by me and and some logic by AI for saving time)
  async transferOwnerShip(
    user: JwtUser,
    groupId: number,
    targetUserId: number,
    ownerForRemoveId?: number,
    ownerNewRole: GroupRole = GroupRole.MODERATOR, // Default về MODERATOR nếu không truyền
    modToBeRemovedId?: number,
  ) {
    const userId = Number(user.id);

    // 1. Check quyền người gọi API
    const userInGroup = await this.prismaService.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!userInGroup || userInGroup.role !== GroupRole.OWNER) {
      throw new ForbiddenException(
        'You do not have permission to do this task',
      );
    }

    // 2. Check targetUser
    const targetUser = await this.prismaService.groupMember.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });

    if (!targetUser) {
      throw new NotFoundException('The target user is not in this group');
    }

    // FIX LỖI: Nếu targetUser đã là Owner rồi thì dừng ngay
    if (targetUser.role === GroupRole.OWNER) {
      throw new BadRequestException('This user is already an Owner');
    }

    if (ownerNewRole === GroupRole.OWNER) {
      throw new BadRequestException('Please be serious!!!');
    }

    // 3. Đếm số lượng Owner & Moderator hiện tại
    const [ownerNumber, moderatorNumber] = await Promise.all([
      this.prismaService.groupMember.count({
        where: { groupId, role: GroupRole.OWNER },
      }),
      this.prismaService.groupMember.count({
        where: { groupId, role: GroupRole.MODERATOR },
      }),
    ]);

    // TRƯỜNG HỢP 1: Chưa đầy Owner -> Thêm thẳng
    if (ownerNumber < GROUP_CONFIG.MAX_OWNERS) {
      const updatedTarget = await this.prismaService.groupMember.update({
        where: { userId_groupId: { userId: targetUserId, groupId } },
        data: { role: GroupRole.OWNER },
      });

      // 💥 TRIGGER NOTIFICATION: Báo cho targetUser đã lên OWNER
      if (userId !== targetUserId) {
        this.eventEmitter.emit(
          'notification.create',
          new NotificationEvents({
            senderId: userId,
            receiverId: targetUserId,
            type: NotificationType.GROUP_OWNERSHIP_TRANSFERRED,
            groupId,
          }),
        );
      }

      return updatedTarget;
    }

    // TRƯỜNG HỢP 2: Đã đầy Owner -> Bắt buộc hạ 1 Owner
    if (!ownerForRemoveId) {
      throw new BadRequestException(
        'The number of Owners has reached the limit. You must remove 1 owner to make a new one',
      );
    }

    const ownerForRemove = await this.prismaService.groupMember.findUnique({
      where: { userId_groupId: { userId: ownerForRemoveId, groupId } },
    });

    if (!ownerForRemove || ownerForRemove.role !== GroupRole.OWNER) {
      throw new NotFoundException(
        'The specified owner to remove was not found or is not an Owner',
      );
    }

    try {
      const result = await this.prismaService.$transaction(async (tx) => {
        // Nếu giáng Owner xuống MODERATOR mà danh sách Mod đã đầy -> Hạ 1 Mod xuống MEMBER trước
        if (
          ownerNewRole === GroupRole.MODERATOR &&
          moderatorNumber >= GROUP_CONFIG.MAX_MODERATOR
        ) {
          if (!modToBeRemovedId) {
            throw new BadRequestException(
              'The number of Moderators has reached maximum limit. Please choose a Moderator to demote',
            );
          }

          const modToBeRemoved = await tx.groupMember.findUnique({
            where: { userId_groupId: { userId: modToBeRemovedId, groupId } },
          });

          if (!modToBeRemoved || modToBeRemoved.role !== GroupRole.MODERATOR) {
            throw new NotFoundException(
              'The moderator to be demoted was not found',
            );
          }

          await tx.groupMember.update({
            where: { userId_groupId: { userId: modToBeRemovedId, groupId } },
            data: { role: GroupRole.MEMBER },
          });
        }

        // Hạ quyền Owner được chọn
        await tx.groupMember.update({
          where: { userId_groupId: { userId: ownerForRemoveId, groupId } },
          data: { role: ownerNewRole },
        });

        // Nâng Target User lên OWNER
        return tx.groupMember.update({
          where: { userId_groupId: { userId: targetUserId, groupId } },
          data: { role: GroupRole.OWNER },
        });
      });

      // 💥 TRIGGER NOTIFICATIONS SAU KHÍ TRANSACTION THÀNH CÔNG:

      // 1. Thông báo cho Target User (lên OWNER)
      if (userId !== targetUserId) {
        this.eventEmitter.emit(
          'notification.create',
          new NotificationEvents({
            senderId: userId,
            receiverId: targetUserId,
            type: NotificationType.GROUP_OWNERSHIP_TRANSFERRED,
            groupId,
          }),
        );
      }

      // 2. Thông báo cho Owner bị giáng cấp (nếu người bị giáng cấp không phải chính người thao tác)
      if (userId !== ownerForRemoveId) {
        this.eventEmitter.emit(
          'notification.create',
          new NotificationEvents({
            senderId: userId,
            receiverId: ownerForRemoveId,
            type: NotificationType.GROUP_PERMISSION_UPDATED,
            groupId,
          }),
        );
      }

      // 3. Thông báo cho Mod bị giáng xuống Member (nếu có)
      if (modToBeRemovedId && userId !== modToBeRemovedId) {
        this.eventEmitter.emit(
          'notification.create',
          new NotificationEvents({
            senderId: userId,
            receiverId: modToBeRemovedId,
            type: NotificationType.GROUP_PERMISSION_UPDATED,
            groupId,
          }),
        );
      }

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.log('transfer role error', error);
      throw new InternalServerErrorException(
        'Something went wrong, please try again',
      );
    }
  }

  //posts handling in the group
}
