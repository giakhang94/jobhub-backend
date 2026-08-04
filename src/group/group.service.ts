import { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BadRequestException,
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
}
