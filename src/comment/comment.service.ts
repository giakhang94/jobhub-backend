import { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { FileService } from '../file/file.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { Role } from '../../generated/prisma/enums.js';

@Injectable()
export class CommentService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly fileService: FileService,
  ) {}
  //create comment
  async createComment(
    user: JwtUser,
    postId: number,
    body: CreateCommentDto,
    file?: Express.Multer.File,
    parentId?: number,
  ) {
    const userId = Number(user.id);
    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Post not found');

    //kiem tra parentId, make sure only 1 level reply
    let effectiveParentId: number | undefined = undefined;

    if (parentId) {
      const parentComment = await this.prismaService.comment.findUnique({
        where: { id: parentId },
      });
      if (!parentComment) {
        throw new NotFoundException('The comment you replied do not exist');
      }

      //check if users comment to a child comment which has a parentId
      //flat this parentId to ID of the original parent
      effectiveParentId = parentComment.parentId ?? parentComment.id;
    }

    //1. upload file to db
    let uploadedFile: any[] = [];
    try {
      if (file)
        uploadedFile = await this.fileService.uploadFilesToCloud([file]);
    } catch (error) {
      console.log('comment service error ', error);
      throw new InternalServerErrorException(
        'can not post this image/document to the comment',
      );
    }
    //2. create comment and upload file url to the db
    try {
      //create a transaction
      const result = await this.prismaService.$transaction(async (tx) => {
        //2.1 save comment to the comment table
        const data = { content: body.content, userId, postId };
        if (effectiveParentId) {
          data['parentId'] = effectiveParentId;
        }

        const comment = await tx.comment.create({
          data: data,
        });

        //2.2 upload file url to file db
        await this.fileService.saveFileRecordsToDB(
          userId,
          uploadedFile,
          tx,
          postId,
          Number(comment.id),
        );
        return tx.comment.findUnique({
          where: { id: comment.id },
          include: { file: true },
        });
      });
      return result;
    } catch (error) {
      console.log('save comment meta error', error);
      //xoa data da luu tren cloud
      const publicIds = uploadedFile.map((f) => f.publicId);
      await this.fileService.deleteFilesFromCloud(publicIds);
      throw new InternalServerErrorException(
        'can not post this comment, please try again',
      );
    }
  }

  //delete comment
  async deleteComment(user: JwtUser, commentId: number) {
    const userId = Number(user.id);
    const comment = await this.prismaService.comment.findUnique({
      where: { id: commentId },
      include: { file: true, replies: { include: { file: true } } },
    });
    if (!comment) throw new NotFoundException('comment not found');
    const post = await this.prismaService.post.findUnique({
      where: { id: comment.postId },
    });
    if (!post)
      throw new NotFoundException('post not found or has been removed');
    if (
      user.role !== Role.ADMIN &&
      userId !== comment.userId &&
      post.createdById !== userId
    ) {
      throw new ForbiddenException('You can not delete this comment');
    }

    //collect all file publicIds
    const parentPublicId = comment.file?.publicId;
    const replyPublicIds = comment.replies
      .map((r) => r.file?.publicId)
      .filter((id): id is string => Boolean(id));

    const allPublicIds = [
      ...(parentPublicId ? [parentPublicId] : []),
      ...replyPublicIds,
    ];
    try {
      const deletedComment = await this.prismaService.comment.delete({
        where: { id: commentId },
      });
    } catch (error) {
      console.log('delete comment error', error);
      throw new InternalServerErrorException(
        'can not delete this comment, please try again',
      );
    }
    //delete file belong with this comment
    if (allPublicIds.length > 0) {
      try {
        await this.fileService.deleteFilesFromCloud(allPublicIds);
      } catch (error) {
        console.log('delete comment from cloud error', error);
      }
    }
    return { message: 'comment deleted' };
  }
}
