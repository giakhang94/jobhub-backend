import { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
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

  // Standard Include Structure for Comments
  private readonly includeComment = {
    where: { parentId: null },
    include: {
      file: true,
      user: { select: { id: true, name: true } },
      replies: {
        include: {
          file: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  };

  async createPost(
    user: JwtUser,
    body: CreatePostDto,
    files: Express.Multer.File[],
  ) {
    let uploadedCloudFiles: any[] = [];
    try {
      if (files && files.length > 0) {
        uploadedCloudFiles = await this.fileService.uploadFilesToCloud(files);
      }
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Upload files failed');
    }

    try {
      return await this.prismaService.$transaction(async (tx) => {
        const newPost = await tx.post.create({
          data: {
            title: body.title,
            slug: body.slug,
            content: body.content,
            categoryId: Number(body.categoryId),
            createdById: Number(user.id),
          },
        });

        if (uploadedCloudFiles.length > 0) {
          await this.fileService.saveFileRecordsToDB(
            newPost.id,
            uploadedCloudFiles,
            tx,
            user.id,
          );
        }

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

  // Get all posts (Newsfeed)
  async getAllPosts(user: JwtUser, page = 1, limit = 10) {
    const skip = limit * (page - 1);

    // 1. Phân quyền ADMIN
    if (user && user.role === Role.ADMIN) {
      const [posts, total] = await Promise.all([
        this.prismaService.post.findMany({
          include: {
            files: true,
            category: true,
            createdBy: true,
            comments: this.includeComment,
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prismaService.post.count(),
      ]);

      return {
        data: posts,
        meta: {
          total,
          page,
          limit,
          totalPage: Math.ceil(total / limit),
        },
      };
    }

    // 2. User thường / Follower
    let followingIds: number[] = [];
    if (user) {
      const follows = await this.prismaService.follow.findMany({
        where: { followerId: user.id },
        select: { followingId: true },
      });
      followingIds = follows.map((fl) => fl.followingId);
    }

    // Conditions: PUBLIC | Bài của chính mình | Bài FOLLOWER của người mình follow
    const whereCondition = {
      OR: [
        { privacy: Privacy.PUBLIC },
        ...(user ? [{ createdById: user.id }] : []),
        ...(followingIds.length > 0
          ? [{ privacy: Privacy.FOLLOWER, createdById: { in: followingIds } }]
          : []),
      ],
    };

    // 💡 Fix: Dùng Promise.all để count đúng tổng số lượng trong DB
    const [posts, total] = await Promise.all([
      this.prismaService.post.findMany({
        where: whereCondition,
        include: {
          category: true,
          files: true,
          createdBy: true,
          comments: this.includeComment,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prismaService.post.count({ where: whereCondition }),
    ]);

    return {
      data: posts,
      meta: {
        total,
        page,
        limit,
        totalPage: Math.ceil(total / limit),
      },
    };
  }

  // Get public posts for guest
  async getAllPublicPostsForGuess(page = 1, limit = 10) {
    const whereCondition = { privacy: Privacy.PUBLIC };
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prismaService.post.findMany({
        where: whereCondition,
        include: {
          files: true,
          category: true,
          createdBy: true,
          comments: this.includeComment,
        },
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

  // Get post by ID
  async getPostById(user: JwtUser, id: number) {
    const role = user.role;
    const userId = Number(user.id);

    const post = await this.prismaService.post.findUnique({
      where: { id },
      include: {
        files: true,
        createdBy: true,
        category: true,
        comments: this.includeComment,
      },
    });

    if (!post) throw new NotFoundException('Post not found');

    if (
      post.privacy === Privacy.PUBLIC ||
      role === Role.ADMIN ||
      userId === post.createdById
    ) {
      return post;
    }

    if (post.privacy === Privacy.PRIVATE) {
      throw new ForbiddenException('You can not see this post');
    }

    // Privacy = FOLLOWER
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

  // Update post
  async updatePost(
    user: JwtUser,
    postId: number,
    files: Express.Multer.File[],
    body: UpdatePostDto,
  ) {
    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (Number(user.id) !== post.createdById) {
      throw new ForbiddenException('You can not edit this post');
    }

    let uploadedFiles: any[] = [];
    if (files && files.length > 0) {
      try {
        uploadedFiles = await this.fileService.uploadFilesToCloud(files);
      } catch (error) {
        console.log('Edit file error', error);
        throw new InternalServerErrorException(
          'Error when uploading new files/images',
        );
      }
    }

    try {
      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedPost = await tx.post.update({
          where: { id: postId },
          data: body,
        });

        if (uploadedFiles.length > 0) {
          await this.fileService.saveFileRecordsToDB(
            updatedPost.id,
            uploadedFiles,
            tx,
            user.id,
          );
        }

        return tx.post.findUnique({
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
      const publicIds = uploadedFiles.map((file) => file.publicId);
      if (publicIds.length > 0) {
        await this.fileService.deleteFilesFromCloud(publicIds);
      }
      throw new InternalServerErrorException(
        'Error when updating post, please try again',
      );
    }
  }

  // Delete post
  async deletePost(user: JwtUser, postId: number) {
    // 💡 Include thêm comments & file của comments để dọn sạch Cloud
    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
      include: {
        files: true,
        comments: {
          include: { file: true },
        },
      },
    });

    if (!post) throw new NotFoundException('Post not found');
    if (Number(user.id) !== post.createdById && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You can not delete this post');
    }

    // Gom publicId của cả Post lẫn Comment
    const postFilePublicIds = post.files
      .map((f) => f.publicId)
      .filter((id): id is string => Boolean(id));

    const commentFilePublicIds = post.comments
      .map((c) => c.file?.publicId)
      .filter((id): id is string => Boolean(id));

    const allPublicIds = [...postFilePublicIds, ...commentFilePublicIds];

    try {
      await this.prismaService.post.delete({ where: { id: postId } });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Can not delete this post');
    }

    if (allPublicIds.length > 0) {
      try {
        await this.fileService.deleteFilesFromCloud(allPublicIds);
      } catch (error) {
        console.log('Delete post files error', error);
      }
    }

    return { message: 'Post deleted successfully' };
  }

  // Delete multiple posts
  async deletePosts(user: JwtUser, ids: number[]) {
    const posts = await this.prismaService.post.findMany({
      where: { id: { in: ids } },
      include: {
        files: true,
        comments: {
          include: { file: true },
        },
      },
    });

    if (posts.length === 0) throw new NotFoundException('Posts not found');

    const isAdmin = user.role === Role.ADMIN;
    const isNotAuthor = posts.filter(
      (post) => Number(post.createdById) !== Number(user.id),
    );

    if (!isAdmin && isNotAuthor.length > 0) {
      throw new ForbiddenException(
        'Only admin or the posts owner can delete multiple posts',
      );
    }

    // Gom toàn bộ Cloud File IDs
    const allPublicIds = posts
      .flatMap((post) => [
        ...post.files.map((f) => f.publicId),
        ...post.comments.map((c) => c.file?.publicId),
      ])
      .filter((id): id is string => Boolean(id));

    try {
      await this.prismaService.post.deleteMany({ where: { id: { in: ids } } });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Can not delete those posts');
    }

    if (allPublicIds.length > 0) {
      try {
        await this.fileService.deleteFilesFromCloud(allPublicIds);
      } catch (error) {
        console.log('From delete posts/files error', error);
      }
    }

    return { message: 'Posts deleted successfully' };
  }
}
