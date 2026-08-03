import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommentService } from './comment.service.js';
import { JwtAuthGuard } from '../auth/guards/Jwt-auth.guard.js';
import { GetUser } from '../auth/decorators/GetUser.Decorator.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post('/:id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async createComment(
    @GetUser() user: JwtUser,
    @Body() body: CreateCommentDto,
    @Param('id') postId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.commentService.createComment(user, Number(postId), body, file);
  }

  @Delete('/:commentId')
  @UseGuards(JwtAuthGuard)
  async deleteComment(
    @GetUser() user: JwtUser,
    @Param('commentId') commentId: string,
  ) {
    return this.commentService.deleteComment(user, Number(commentId));
  }
}
