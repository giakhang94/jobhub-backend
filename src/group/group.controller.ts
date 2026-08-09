import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GroupService } from './group.service.js';

import type { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { UpdateMemberPermissionsDto } from './dto/update-member-permission.dto.js';
import { JwtAuthGuard } from '../auth/guards/Jwt-auth.guard.js';
import { GetUser } from '../auth/decorators/GetUser.Decorator.js';
import { ApproveMultipleDto } from './dto/approve-multiple-request.dto.js';
import { TransferOwnershipDto } from './dto/transferOwnership.dto.js';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  // -----------------------------------------------------------------------
  // 1. GROUP BASE
  // -----------------------------------------------------------------------

  @Post()
  async createGroup(@GetUser() user: JwtUser, @Body() body: CreateGroupDto) {
    return this.groupService.createGroup(user, body);
  }

  @Get(':groupId')
  async getGroupById(@Param('groupId', ParseIntPipe) groupId: number) {
    return this.groupService.getGroupById(groupId);
  }

  @Post(':groupId/join')
  @HttpCode(HttpStatus.OK)
  async joinGroup(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.groupService.joinGroup(user, groupId);
  }

  @Post(':groupId/leave')
  @HttpCode(HttpStatus.OK)
  async leaveGroup(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.groupService.leaveGroup(user, groupId);
  }

  @Delete(':groupId')
  async deleteGroup(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.groupService.deleteGroup(user, groupId);
  }

  // -----------------------------------------------------------------------
  // 2. JOIN REQUEST MANAGEMENT
  // -----------------------------------------------------------------------

  @Get(':groupId/requests')
  async getPendingRequest(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.groupService.getPendingRequest(user, groupId);
  }

  @Post(':groupId/requests/:targetUserId/approve')
  @HttpCode(HttpStatus.OK)
  async approveRequest(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('targetUserId', ParseIntPipe) targetUserId: number,
  ) {
    return this.groupService.approveRequest(user, groupId, targetUserId);
  }

  @Post(':groupId/requests/approve-multiple')
  @HttpCode(HttpStatus.OK)
  async approveMultipleRequests(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: ApproveMultipleDto,
  ) {
    return this.groupService.approveMultipleRequests(
      user,
      groupId,
      dto.targetUserIds,
    );
  }

  @Delete(':groupId/requests/:targetUserId/reject')
  async rejectRequest(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('targetUserId', ParseIntPipe) targetUserId: number,
  ) {
    return this.groupService.rejectRequest(user, groupId, targetUserId);
  }

  // -----------------------------------------------------------------------
  // 3. MEMBER PERMISSIONS & MANAGEMENT
  // -----------------------------------------------------------------------

  @Delete(':groupId/members/:memberId/kick')
  async kickMember(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
  ) {
    return this.groupService.kickMember(user, memberId, groupId);
  }

  @Patch(':groupId/members/:targetUserId/permissions')
  async updateMemberPermission(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('targetUserId', ParseIntPipe) targetUserId: number,
    @Body() body: UpdateMemberPermissionsDto,
  ) {
    return this.groupService.updateMemberPermission(
      user,
      targetUserId,
      groupId,
      body,
    );
  }

  @Post(':groupId/members/:targetUserId/transfer-ownership')
  @HttpCode(HttpStatus.OK)
  async transferOwnerShip(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('targetUserId', ParseIntPipe) targetUserId: number,
    @Body() dto: TransferOwnershipDto,
  ) {
    return this.groupService.transferOwnerShip(
      user,
      groupId,
      targetUserId,
      dto.ownerForRemoveId,
      dto.ownerNewRole,
      dto.modToBeRemovedId,
    );
  }
}
