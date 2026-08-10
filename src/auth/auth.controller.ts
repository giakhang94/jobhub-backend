import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CreateUserDto } from './dtos/create-user.dto.js';
import { LocalGuard } from './guards/Local.guard.js';
import { GetUser } from './decorators/GetUser.Decorator.js';
import type { Response } from 'express';
import type { JwtUser } from './interfaces/jwt-user.interface.js';
import { JwtAuthGuard } from './guards/Jwt-auth.guard.js';
import { JwtRefreshAuthGuard } from './guards/Jwt-refresh-auth.guard.js';
import { PassThrough } from 'stream';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  //create a new user
  @Post('register')
  async createUser(@Body() body: CreateUserDto) {
    return this.authService.createUser(body);
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    const date = new Date(Date.now());
    return this.authService.verifyEmail(token, date);
  }

  @Post('login')
  @UseGuards(LocalGuard)
  async login(
    @GetUser() user: JwtUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(user, res);
  }

  //refresh token
  @Get('refresh-token')
  @UseGuards(JwtRefreshAuthGuard)
  async refreshToken(
    @GetUser() user: JwtUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.refreshToken(user, res);
  }

  //test strategy
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@GetUser() user: JwtUser) {
    console.log('me working');
    return user;
  }

  //resend verification email
  @Post('resend-verification')
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerificationEmail(email);
  }
}
