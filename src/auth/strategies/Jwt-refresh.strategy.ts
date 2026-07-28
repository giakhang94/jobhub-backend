import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { JwtPayload } from './Jwt.strategy.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserStatus } from '../../../generated/prisma/enums.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        const refreshToken = req?.cookies?.refreshToken;
        if (refreshToken) return refreshToken;
        return null;
        // const cookie = req.headers['cookie'];
        // if (!cookie) return null;
        // const cookieArray = cookie.split(';');
        // let refreshToken = cookieArray.find((item: string) => {
        //   return item.trim().startsWith('refreshToken=');
        // });
        // if (!refreshToken) {
        //   return null;
        // }
        // refreshToken = refreshToken.trim().split('=')[1];
        // console.log(refreshToken);
        // return refreshToken;
      },
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true, // có dòng này thì mới xài req ở hàm validate bên dưới được
      //nếu không có thì mặc định payload là tham số thứ nhất.
    });
  }
  async validate(req: Request, payload: JwtPayload) {
    const user = await this.prismaService.user.findFirst({
      where: {
        id: Number(payload.sub),
      },
      select: {
        id: true,
        role: true,
        fullname: true,
        status: true,
        email: true,
        refreshTokenHash: true,
      },
    });
    if (!user) throw new BadRequestException('user not found');
    if (user.status !== UserStatus.ACTIVE)
      throw new UnauthorizedException(
        'user is not activated or has been blocked',
      );
    const isMatchToken =
      user.refreshTokenHash &&
      bcrypt.compare(req?.cookies.refreshToken, user.refreshTokenHash!);
    if (!isMatchToken)
      throw new UnauthorizedException('Invalid or revoked refresh token');
    return user;
  }
}
