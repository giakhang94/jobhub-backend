import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { NotificationController } from './notification.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  providers: [NotificationService],
  controllers: [NotificationController],
  imports: [AuthModule, PrismaModule],
})
export class NotificationModule {}
