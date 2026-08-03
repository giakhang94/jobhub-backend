import { Module } from '@nestjs/common';
import { CommentController } from './comment.controller.js';
import { CommentService } from './comment.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { FileModule } from '../file/file.module.js';

@Module({
  controllers: [CommentController],
  providers: [CommentService],
  imports: [PrismaModule, AuthModule, FileModule],
})
export class CommentModule {}
