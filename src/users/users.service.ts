import { Injectable } from '@nestjs/common';

import { CreateUserDto } from '../auth/dtos/create-user.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
    const isExistFollowing = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });
    if (!isExistFollowing) {
      return this.prisma.follow.create({
        data: {
          followerId,
          followingId,
        },
      });
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
