import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Role, UserStatus } from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Request } from 'express';

export interface JwtPayload {
  sub: string; //userId
  email: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        if (req?.cookies?.accessToken) {
          return req.cookies.accessToken;
        }
        const cookieHeader = req?.headers?.cookie;
        if (!cookieHeader) return null;
        const cookies = Object.fromEntries(
          cookieHeader.split(';').map((c: string) => c.trim().split('=')),
        );
        // console.log(cookies);
        return cookies['accessToken'];
      },
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }
  async validate(payload: JwtPayload) {
    // console.log('validate here working');
    const user = await this.prismaService.user.findUnique({
      where: { id: Number(payload.sub) },
      select: {
        id: true,
        role: true,
        fullname: true,
        email: true,
        status: true,
      },
    });
    if (!user) throw new BadRequestException('User not found');
    if (user.status !== UserStatus.ACTIVE)
      throw new UnauthorizedException('User is not active or has been blocked');
    return user;
  }
}
