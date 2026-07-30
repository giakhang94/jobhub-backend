import { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreatePostDto } from './dtos/create-post.dto.js';
import { FileService } from '../file/file.service.js';

@Injectable()
export class PostsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly fileService: FileService,
  ) {}

  async createPost(
    user: JwtUser,
    body: CreatePostDto,
    files: Express.Multer.File[],
  ) {
    //try-catch upload files
    let uploadedCloudFiles: any[] = [];
    try {
      if (files && files.length > 0) {
        uploadedCloudFiles = await this.fileService.uploadFilesToCloud(files);
      }
    } catch (error) {
      console.log(error);
      throw new BadRequestException('upload files failed');
    }

    //try-catch 2: transaction save records to db
    try {
      return await this.prismaService.$transaction(async (tx) => {
        //1. create new post
        const newPost = await tx.post.create({
          data: {
            title: body.title,
            slug: body.slug,
            content: body.content,
            categoryId: Number(body.categoryId),
            createdById: Number(user.id),
          },
        });
        //2. call the file service to save files link to db
        if (uploadedCloudFiles.length > 0) {
          await this.fileService.saveFileRecordsToDB(
            newPost.id,
            user.id,
            uploadedCloudFiles,
            tx,
          );
        }

        // return post data and file data
        return tx.post.findUnique({
          where: { id: newPost.id },
          include: {
            files: true,
            category: true,
          },
        });
      });
    } catch (error) {
      if (uploadedCloudFiles.length > 0) {
        const publicIds = uploadedCloudFiles.map((file) => file.publicId);
        await this.fileService.deleteFilesFromCloud(publicIds);
      }
      throw new InternalServerErrorException(
        'Create post failed, please try again',
      );
    }
  }
}
