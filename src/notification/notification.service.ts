import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationEvents } from './events/notification.events.js';

export interface CrateNotificationDto {
  senderId: number;
  receiverId: number;
  type: NotificationType;
  postId: number;
}

@Injectable()
export class NotificationService {
  constructor(private readonly prismaService: PrismaService) {}
  //listen events
  @OnEvent('notification.create')
  async handleNotificationEvent(payload: NotificationEvents) {
    if (payload.senderId === payload.receiverId) {
      return null;
    }

    return this.prismaService.notification.create({
      data: {
        senderId: payload.senderId,
        receiverId: payload.receiverId,
        type: payload.type,
        postId: payload.postId ?? null,
        groupId: payload.groupId ?? null,
      },
    });
  }
  @OnEvent('notifications.createMany')
  async handleNotificationsEvent(payload: NotificationEvents[]) {
    //check if the payload array is empty
    if (
      !payload ||
      (payload && !Array.isArray(payload)) ||
      payload.length === 0
    ) {
      return null;
    }
    //map the instance array to a plain object
    const notificationsData = payload
      .filter((item) => item.senderId !== item.receiverId)
      .map((item) => ({
        senderId: item.senderId,
        receiverId: item.receiverId,
        type: item.type,
        postId: item.postId ?? null,
        groupId: item.groupId ?? null,
      }));

    if (notificationsData.length === 0) return null;
    return this.prismaService.notification.createMany({
      data: notificationsData,
    });
  }

  //create a new notification
  async createNotification(body: CrateNotificationDto) {
    if (body.senderId === body.receiverId) return null;
    return this.prismaService.notification.create({
      data: {
        senderId: body.senderId,
        receiverId: body.receiverId,
        type: body.type,
        postId: body.postId ?? null,
      },
    });
  }

  //get user notifications
  async getNotifications(userId: number) {
    const notifications = await this.prismaService.notification.findMany({
      where: { receiverId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, fullname: true, avatar: true },
        },
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });
    const unreadCount = await this.prismaService.notification.count({
      where: { receiverId: userId, isRead: false },
    });
    return {
      notifications,
      unreadCount,
    };
  }

  //mark as read (1 or all)
  async markAsRead(userId: number, notificationId: number) {
    if (!notificationId) {
      //mark as read for all notifications
      return this.prismaService.notification.updateMany({
        where: {
          receiverId: userId,
          isRead: false,
        },
        data: { isRead: true },
      });
    }
    //mark as read for a specific notification
    const notification = await this.prismaService.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException('notification not found');

    if (notification.receiverId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this notification',
      );
    }
    //update
    return this.prismaService.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }
}
