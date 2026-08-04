import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GroupService } from './group.service.js';
import { JwtAuthGuard } from '../auth/guards/Jwt-auth.guard.js';
import { GetUser } from '../auth/decorators/GetUser.Decorator.js';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { CreateGroupDto } from './dto/create-group.dto.js';

@Controller('group')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createGroup(@GetUser() user: JwtUser, @Body() body: CreateGroupDto) {
    return this.groupService.createGroup(user, body);
  }
}
