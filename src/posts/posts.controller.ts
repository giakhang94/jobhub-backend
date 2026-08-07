import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import { SharePostDto } from './dtos/share-post.dto.js';

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
  //delete post
  @Delete('/:id')
  @UseGuards(JwtAuthGuard)
  async deletePost(@GetUser() user: JwtUser, @Param('id') postId: string) {
    return this.postsService.deletePost(user, Number(postId));
  }

  //delete posts
  @Delete('delete-many/:id')
  @UseGuards(JwtAuthGuard)
  async deletePosts(@GetUser() user: JwtUser, @Body('ids') ids: number[]) {
    return this.postsService.deletePosts(user, ids);
  }

  //share post
  @Post('share/:originalPostId')
  @UseGuards(JwtAuthGuard)
  async sharePost(
    @GetUser() user: JwtUser,
    @Param('originalPostId') originalPostId: string,
    body: SharePostDto,
  ) {
    return this.postsService.sharePost(user, body, Number(originalPostId));
  }

  //group post handling
  //get pending posts
  @Get('/:groupId/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingPosts(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.postsService.getPendingPosts(user, groupId);
  }
  //approve post
  @Patch('/approve/:groupId/:postId')
  @UseGuards(JwtAuthGuard)
  async approvePost(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return this.postsService.approvePost(user, postId, groupId);
  }
  //reject post
  @Patch('/reject/:groupId/:postId')
  @UseGuards(JwtAuthGuard)
  async rejectPost(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return this.postsService.rejectPost(user, postId, groupId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllGroupPosts(@GetUser() user: JwtUser, @Query() query: any) {
    const { page, limit } = query;
    return this.postsService.getGroupPosts(
      user,
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  @Delete('/group-post/:groupId/:postId')
  @UseGuards(JwtAuthGuard)
  async deleteGroupPost(
    @GetUser() user: JwtUser,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return this.postsService.deleteGroupPost(user, postId, groupId);
  }
}
