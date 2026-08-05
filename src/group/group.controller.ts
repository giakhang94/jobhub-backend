import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GroupService } from './group.service.js';
import { JwtAuthGuard } from '../auth/guards/Jwt-auth.guard.js';
import { GetUser } from '../auth/decorators/GetUser.Decorator.js';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { ApproveMultipleDto } from './dto/approve-multiple-request.dto.js';

@Controller('group')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createGroup(@GetUser() user: JwtUser, @Body() body: CreateGroupDto) {
    return this.groupService.createGroup(user, body);
  }

  @Post('/leave/:groupId')
  @UseGuards(JwtAuthGuard)
  async leaveGroup(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.groupService.leaveGroup(user, Number(groupId));
  }

  @Delete('/:groupId')
  @UseGuards(JwtAuthGuard)
  async deleteGroup(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.groupService.deleteGroup(user, Number(groupId));
  }

  //request handling
  @Get('/request/:id')
  @UseGuards(JwtAuthGuard)
  async getJoinRequest(
    @GetUser() user: JwtUser,
    @Param('id', ParseIntPipe) groupId: string,
  ) {
    return this.groupService.getPendingRequest(user, Number(groupId));
  }

  @Post('/approve/:groupId/:targetUserId')
  @UseGuards(JwtAuthGuard)
  async approveMember(
    @GetUser() user: JwtUser,
    @Param('groupId, ParseIntPipe') groupId: number,
    @Param('targetUserId, ParseIntPipe') targetUserId: number,
  ) {
    return this.groupService.approveRequest(
      user,
      Number(groupId),
      Number(targetUserId),
    );
  }

  @Post('/approve-all/:groupId')
  @UseGuards(JwtAuthGuard)
  async approveAllRequest(
    @Body() body: ApproveMultipleDto,
    @Param('groupId, ParseIntPipe') groupId: number,
    @GetUser() user: JwtUser,
  ) {
    return this.groupService.approveMultipleRequests(
      user,
      Number(groupId),
      body.targetUserIds,
    );
  }

  //reject request
  @Post('reject/:groupId/:targetUserId')
  @UseGuards(JwtAuthGuard)
  async rejectRequest(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('targetUserId', ParseIntPipe) targetUserId: number,
  ) {
    return this.rejectRequest(user, groupId, targetUserId);
  }
}
