import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from '../auth/dtos/create-user.dto.js';
import * as bcrypt from 'bcrypt';
import { FollowDto } from './dtos/follow.dto.js';
import { GetUser } from '../auth/decorators/GetUser.Decorator.js';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { JwtAuthGuard } from '../auth/guards/Jwt-auth.guard.js';
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  //get all users
  @Get()
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  //create a new user
  @Post()
  async createUser(@Body() body: CreateUserDto) {
    return this.usersService.createUser(body);
  }

  //toggle follow
  @Post('follow')
  @UseGuards(JwtAuthGuard)
  async toggleFollow(@Body() body: FollowDto, @GetUser() user: JwtUser) {
    return this.usersService.toggleFollowUser(Number(user.id), body.following);
  }

  //get all users in group
  @Get('group/:groupId/all')
  @UseGuards(JwtAuthGuard)
  async getAllUserInGroup(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.usersService.getAllUserInGroup(user, groupId);
  }
}
