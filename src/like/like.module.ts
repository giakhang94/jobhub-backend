import { Module } from '@nestjs/common';
import { LikeController } from './like.controller.js';
import { LikeService } from './like.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  controllers: [LikeController],
  providers: [LikeService],
  imports: [PrismaModule, AuthModule],
  //import authModule to use the jwtStrategy
})
export class LikeModule {}
