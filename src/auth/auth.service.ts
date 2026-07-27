import { BadRequestException, Injectable } from '@nestjs/common';

import { CreateUserDto } from './dtos/create-user.dto.js';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  //create a new user
  async createUser(body: CreateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: body.email,
      },
    });

    if (user) {
      throw new BadRequestException('Email đã tồn tại');
    }
    const hashedPassword = await bcrypt.hash(body.password, 10);
    return this.prisma.user.create({
      data: {
        ...body,
        password: hashedPassword,
      },
    });
  }

  //validate user for local strategy
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return null;
    }
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return null;
    }
    return user;
  }
}
