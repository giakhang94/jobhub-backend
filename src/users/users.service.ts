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
}
