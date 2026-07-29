import { Module } from '@nestjs/common';
import { PostsService } from './posts.service.js';
import { PostsController } from './posts.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  providers: [PostsService],
  controllers: [PostsController],
  imports: [AuthModule, PrismaModule],
})
export class PostsModule {}
