import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  providers: [AuthService],
  controllers: [AuthController],
  imports: [PrismaModule, MailModule],
})
export class AuthModule {}
