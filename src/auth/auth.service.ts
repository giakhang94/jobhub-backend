import { BadRequestException, Injectable } from '@nestjs/common';

import { CreateUserDto } from './dtos/create-user.dto.js';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

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
    //tao token bang crypto va token_expires
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(
      Date.now() +
        Number(this.configService.get<number>('MAIL_EXP', 24) * 60 * 60 * 1000),
    ); // 24 hours.
    const newUser = await this.prisma.user.create({
      data: {
        ...body,
        password: hashedPassword,
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpiry: verificationExpires,
      },
    });
    //xu ly goi mail
    //goi mail
    await this.mailService.sendUserConfirmation(
      newUser.email,
      verificationToken,
      newUser.fullname,
    );

    return newUser;
  }

  //verify email
  async verifyEmail(token: string, date: Date) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });
    if (!user) {
      throw new BadRequestException('Token không hợp lệ');
    }
    if (user.emailVerificationTokenExpiry! < date) {
      throw new BadRequestException('Token đã hết hạn');
    }
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'ACTIVE',
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
      },
    });
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
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
