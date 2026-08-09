import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { CreateUserDto } from './dtos/create-user.dto.js';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service.js';
import { Response } from 'express';
import type { JwtUser } from './interfaces/jwt-user.interface.js';
import { JwtService } from '@nestjs/jwt';
import { attachCookie } from './utils/attackCookie.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
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

    if (!user)
      throw new NotFoundException('User chưa đăng ký tài khoản hoặc đã bị xóa');
    if (!user?.emailVerificationTokenExpiry) {
      throw new BadRequestException('Token không tôn tại');
    }
    if (!user) {
      throw new BadRequestException('Token không hợp lệ');
    }
    if (user.emailVerificationTokenExpiry < date) {
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

  //login
  async login(user: JwtUser, res: Response) {
    const payload = { sub: user.id, role: user.role, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.getOrThrow('JWT_REFRESH_EXPIRES_IN'),
    });
    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          refreshTokenHash: await bcrypt.hash(refreshToken, 10),
        },
      });
      attachCookie(
        res,
        'accessToken',
        accessToken,
        this.configService.getOrThrow('JWT_EXPIRES_IN'),
        this.configService,
      );
      attachCookie(
        res,
        'refreshToken',
        refreshToken,
        this.configService.getOrThrow('JWT_REFRESH_EXPIRES_IN'),
        this.configService,
      );
    } catch (error: any) {
      console.log(error);
      throw new InternalServerErrorException(
        'something went wrong, please try again in a few minutes',
      );
    }

    return { message: 'login thanh cong' };
  }
  //refresh token
  async refreshToken(user: JwtUser, res: Response) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);
    attachCookie(
      res,
      'accessToken',
      accessToken,
      this.configService.getOrThrow('JWT_EXPIRES_IN'),
      this.configService,
    );
    return { message: 'access token has been refreshed successfully' };
  }

  //I used AI to create this method for saving time
  //I only ask AI to create a whole method when I'm sure that I can write by myself without errors
  // Resend verification email
  async resendVerificationEmail(email: string) {
    if (!email) {
      throw new BadRequestException('Vui lòng cung cấp email');
    }

    // 1. Kiểm tra user có tồn tại không
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('Email không tồn tại trong hệ thống');
    }

    // 2. Nếu tài khoản đã xác thực rồi thì không gửi lại
    if (user.status === 'ACTIVE') {
      throw new BadRequestException('Tài khoản này đã được xác thực trước đó');
    }

    // 3. Tạo token mới và tính lại hạn hết hiệu lực
    const newVerificationToken = crypto.randomBytes(32).toString('hex');
    const mailExpHours = Number(this.configService.get('MAIL_EXP', 24));

    const newVerificationExpires = new Date(
      Date.now() + mailExpHours * 60 * 60 * 1000,
    );

    // 4. Update thông tin token mới vào DB
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: newVerificationToken,
        emailVerificationTokenExpiry: newVerificationExpires,
      },
    });

    // 5. Bắn email xác thực mới
    await this.mailService.sendUserConfirmation(
      user.email,
      newVerificationToken,
      user.fullname,
    );

    return {
      message:
        'Đã gửi lại email xác thực thành công. Vui lòng kiểm tra hòm thư!',
    };
  }
}
