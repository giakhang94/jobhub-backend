import { NotificationType } from '../../../generated/prisma/enums.js';

export class NotificationEvents {
  senderId!: number;
  receiverId!: number;
  postId?: number;
  type!: NotificationType;

  constructor(partial: Partial<NotificationEvents>) {
    Object.assign(this, partial);
  }
}
