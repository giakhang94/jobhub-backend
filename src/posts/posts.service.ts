import { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Injectable } from '@nestjs/common';
import { CreatePostDto } from './dtos/create-post.dto.js';

@Injectable()
export class PostsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createPost(user: JwtUser, body: CreatePostDto) {}
}
