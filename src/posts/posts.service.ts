import { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreatePostDto } from './dtos/create-post.dto.js';
import { FileService } from '../file/file.service.js';
import { Privacy, Role } from '../../generated/prisma/enums.js';
import { UpdatePostDto } from './dtos/update-post.dto.js';

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
  //get all posts
  async getAllPosts(user: JwtUser, page = 1, limit = 10) {
    const skip = limit * (page - 1);
    //for admin
    if (user && user.role === 'ADMIN') {
      return this.prismaService.post.findMany({
        include: {
          files: true,
          category: true,
          createdBy: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
    }

    // for follower => public and post that allowed followers to see
    let followingIds: number[] = [];

    //1. get the following IDs of this user
    if (user) {
      const follows = await this.prismaService.follow.findMany({
        where: {
          followerId: user.id,
        },
        select: { followingId: true },
      });
      //this query will return and object array
      //like [{followingId: 1}, {followingId:2},...]
      //we have to convert this object to an array
      followingIds = follows.map((fl) => fl.followingId);
    }
    //2. query all follower-allow post and public post
    const post = await this.prismaService.post.findMany({
      where: {
        OR: [
          { privacy: Privacy.PUBLIC },
          ...(user ? [{ createdById: user.id }] : []),
          ...(followingIds.length > 0
            ? [{ privacy: Privacy.FOLLOWER, createdById: { in: followingIds } }]
            : []),
        ],
      },
      include: {
        category: true,
        files: true,
        createdBy: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
    const total = post.length;
    return {
      data: post,
      meta: {
        total: total,
        page,
        limit,
        totalPage: Math.ceil(total / limit),
      },
    };
  }
  //get posts for guess (only public posts)
  async getAllPublicPostsForGuess(page: number, limit: number) {
    const whereCondition = { privacy: Privacy.PUBLIC };
    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
      this.prismaService.post.findMany({
        where: whereCondition,
        include: { files: true, category: true, createdBy: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.post.count({ where: whereCondition }),
    ]);
    return {
      data: posts,
      meta: { total, page, limit, totalPage: Math.ceil(total / limit) },
    };
  }
  //get post by id
  async getPostById(user: JwtUser, id: number) {
    const role = user.role;
    const userId = Number(user.id);
    const post = await this.prismaService.post.findUnique({
      where: { id },
      include: { files: true, createdBy: true, category: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (
      post.privacy === Privacy.PUBLIC ||
      role === Role.ADMIN ||
      userId === post.createdById
    )
      return post;
    if (post.privacy === Privacy.PRIVATE) {
      throw new ForbiddenException('You can not see this post');
    }
    const userFollowsCreator = await this.prismaService.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: post.createdById,
        },
      },
    });
    if (userFollowsCreator) {
      return post;
    }
    throw new ForbiddenException('You can not see this post');
  }

  //update post
  async updatePost(
    user: JwtUser,
    postId: number,
    files: Express.Multer.File[],
    body: UpdatePostDto,
  ) {
    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
      include: { files: true, category: true, createdBy: true },
    });
    if (!post) throw new NotFoundException('post not found');
    if (Number(user.id) !== post.createdById)
      throw new ForbiddenException('You can not edit this post');
    let uploadedFiles: any[] = [];
    //upload files
    if (files && files.length > 0) {
      try {
        uploadedFiles = await this.fileService.uploadFilesToCloud(files);
      } catch (error) {
        console.log('edit file error', error);
        throw new InternalServerErrorException(
          'error when uploading new files/images',
        );
      }
    }
    //create transaction upload files url to db and post meta data to db
    try {
      const result = await this.prismaService.$transaction(async (tx) => {
        //1. update post
        const updatedPost = await tx.post.update({
          where: { id: postId },
          data: body,
        });
        //2. upload file urls
        if (uploadedFiles && uploadedFiles.length > 0) {
          const newFiles = await this.fileService.saveFileRecordsToDB(
            postId,
            user.id,
            uploadedFiles,
            tx,
          );
        }
        return await tx.post.findUnique({
          where: { id: updatedPost.id },
          include: {
            files: true,
            createdBy: true,
            category: true,
          },
        });
      });
      return result;
    } catch (error) {
      console.log(error);
      //delete uploaded file
      const publicIds = uploadedFiles.map((file) => file.publicId);
      await this.fileService.deleteFilesFromCloud(publicIds);
      throw new InternalServerErrorException(
        'error when updating post, please try again',
      );
    }
  }

  //delete post
  async deletePost(user: JwtUser, postId: number) {
    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
      include: { files: true, category: true, createdBy: true },
    });
    if (!post) throw new NotFoundException('post not found');
    if (Number(user.id) !== post.createdById && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You can not delete this post');
    }
    try {
      //1. delete post record

      await this.prismaService.post.delete({ where: { id: postId } });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('can not delete this post');
    }
    //2. delete files from cloud
    try {
      let publicIds = post.files
        .map((file) => (file.publicId ? [file.publicId] : []))
        .flat();

      if (publicIds && publicIds.length > 0)
        await this.fileService.deleteFilesFromCloud(publicIds);
    } catch (error) {
      console.log('delete post files error', error);
      // throw new InternalServerErrorException(
      //   'can not delete related files from cloud',
      // ); <== no need to throw this exception, avoid misunderstanding from users
    }
    return { message: 'post deleted' };
  }
}
