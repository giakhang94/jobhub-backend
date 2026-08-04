import { BadRequestException, Injectable } from '@nestjs/common';

import { CreateUserDto } from '../auth/dtos/create-user.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationEvents } from '../notification/events/notification.events.js';
import { NotificationType } from '../../generated/prisma/enums.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  //get all users
  async getAllUsers() {
    return this.prisma.user.findMany();
  }

  //create a new user
  async createUser(body: CreateUserDto) {
    return this.prisma.user.create({
      data: body,
    });
  }

  //toggle follow/unfollow
  async toggleFollowUser(followerId: number, followingId: number) {
    //check if the follower has followed another?
    // const follower = await this.prisma.user.findUnique({
    //   where: { id: followerId },
    //   include: { following: true },
    // });
    // const isExistFollowing = follower?.following.find(
    //   (following) => following.followingId === followingId,
    // );
    if (followerId === followingId) {
      throw new BadRequestException('No need to follow yourself');
    }
    const isExistFollowing = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });
    if (!isExistFollowing) {
      const followRecord = await this.prisma.follow.create({
        data: {
          followerId,
          followingId,
        },
      });
      this.eventEmitter.emit(
        'notification.create',
        new NotificationEvents({
          senderId: followerId,
          receiverId: followingId,
          type: NotificationType.FOLLOW,
        }),
      );
      return followRecord;
    } else {
      return this.prisma.follow.delete({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });
    }
  }
}
