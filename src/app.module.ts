import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from './mail/mail.module.js';
import { PostsModule } from './posts/posts.module.js';
import { FileModule } from './file/file.module.js';
import { CloudinaryModule } from './cloudinary/cloudinary.module.js';
import { LikeModule } from './like/like.module.js';
import { CommentModule } from './comment/comment.module.js';
import { NotificationModule } from './notification/notification.module.js';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GroupModule } from './group/group.module.js';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    MailModule,
    PostsModule,
    FileModule,
    CloudinaryModule,
    LikeModule,
    CommentModule,
    NotificationModule,
    EventEmitterModule.forRoot(),
    GroupModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
