import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service.js';
import { CreateUserDto } from './dtos/create-user.dto.js';

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
