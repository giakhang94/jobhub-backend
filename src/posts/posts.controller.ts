import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PostsService } from './posts.service.js';
import { JwtAuthGuard } from '../auth/guards/Jwt-auth.guard.js';
import { GetUser } from '../auth/decorators/GetUser.Decorator.js';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { CreatePostDto } from './dtos/create-post.dto.js';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UpdatePostDto } from './dtos/update-post.dto.js';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 10))
  async createPost(
    @GetUser() user: JwtUser,
    @Body() body: CreatePostDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.postsService.createPost(user, body, files);
  }

  //get all posts with pagination
  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllPosts(@GetUser() user: JwtUser, @Query() query: any) {
    const { page, limit } = query;
    return this.postsService.getAllPosts(
      user,
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  //get all public posts with pagination for guesses
  @Get('guess')
  async getAllPublicPostsForGuess(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.postsService.getAllPublicPostsForGuess(
      Number(page),
      Number(limit),
    );
  }

  //get post by ID
  @Get('/:id')
  @UseGuards(JwtAuthGuard)
  async getPostById(@GetUser() user: JwtUser, @Param('id') id: string) {
    return this.postsService.getPostById(user, Number(id));
  }

  //edit post by id
  @Patch('/:id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files'))
  async editPost(
    @GetUser() user: JwtUser,
    @Param('id') id: string,
    files: Express.Multer.File[],
    @Body() body: UpdatePostDto,
  ) {
    return this.postsService.updatePost(user, Number(id), files, body);
  }
}
