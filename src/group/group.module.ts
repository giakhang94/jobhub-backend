import { Module } from '@nestjs/common';
import { GroupController } from './group.controller.js';
import { GroupService } from './group.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  controllers: [GroupController],
  providers: [GroupService],
  imports: [PrismaModule, AuthModule],
})
export class GroupModule {}
