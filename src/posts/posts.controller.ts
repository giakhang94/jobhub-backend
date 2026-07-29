import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PostsService } from './posts.service.js';
import { JwtAuthGuard } from '../auth/guards/Jwt-auth.guard.js';
import { GetUser } from '../auth/decorators/GetUser.Decorator.js';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { CreatePostDto } from './dtos/create-post.dto.js';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  async createPost(@GetUser() user: JwtUser, @Body() body: CreatePostDto) {
    return this.postsService.createPost(user, body);
  }
}
