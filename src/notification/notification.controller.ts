import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { JwtAuthGuard } from '../auth/guards/Jwt-auth.guard.js';
import { GetUser } from '../auth/decorators/GetUser.Decorator.js';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface.js';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('/:id')
  @UseGuards(JwtAuthGuard)
  async getNotificationByUserId(@GetUser() user: JwtUser) {
    return this.notificationService.getNotifications(Number(user.id));
  }

  @Patch('/mark-as-read/:id')
  @UseGuards(JwtAuthGuard)
  async markAsReadById(
    @Param('id') notificationId: string,
    @GetUser() user: JwtUser,
  ) {
    return this.notificationService.markAsRead(
      Number(user.id),
      Number(notificationId),
    );
  }
}
