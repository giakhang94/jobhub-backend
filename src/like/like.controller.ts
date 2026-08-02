import { GetUser } from '../auth/decorators/GetUser.Decorator.js';
import { JwtAuthGuard } from '../auth/guards/Jwt-auth.guard.js';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { LikeService } from './like.service.js';

@Controller('like')
@UseGuards(JwtAuthGuard)
export class LikeController {
  constructor(private readonly likeService: LikeService) {}
  @Post('/:id')
  async toggleLike(@GetUser() user: JwtUser, @Param('id') postId: string) {
    return this.likeService.toggleLike(user, Number(postId));
  }
}
