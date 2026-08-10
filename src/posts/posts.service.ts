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
import {
  GroupPrivacy,
  GroupRole,
  NotificationType,
  PostStatus,
  Privacy,
  Role,
} from '../../generated/prisma/enums.js';
import { UpdatePostDto } from './dtos/update-post.dto.js';
import { SharePostDto } from './dtos/share-post.dto.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationEvents } from '../notification/events/notification.events.js';

@Injectable()
export class PostsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly fileService: FileService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createPost(
    user: JwtUser,
    body: CreatePostDto,
    files: Express.Multer.File[],
  ) {
    const userId = Number(user.id);
    const groupId = Number(body.groupId);
    //check if the creator is in the group

    if (groupId) {
      const userInGroup = await this.prismaService.groupMember.findUnique({
        where: { userId_groupId: { userId, groupId } },
        include: { group: true },
      });
      if (!userInGroup) {
        throw new ForbiddenException('you are not in this group');
      }
      if (
        userInGroup.group.requireApprove &&
        userInGroup.role !== GroupRole.OWNER &&
        userInGroup.role !== GroupRole.MODERATOR
      ) {
        body.status = PostStatus.PENDING;
      } else {
        body.status = PostStatus.PUBLISHED;
      }
    }
    const category = await this.prismaService.category.findUnique({
      where: { id: body.categoryId },
    });
    if (!category)
      throw new BadRequestException('Please choose a category we provided');
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
      const result = await this.prismaService.$transaction(async (tx) => {
        //1. create new post
        const newPost = await tx.post.create({
          data: {
            title: body.title,
            slug: body.slug,
            content: body.content,
            categoryId: Number(body.categoryId),
            createdById: Number(user.id),
            groupId: body.groupId ? Number(body.groupId) : null,
            status: body.status,
          },
        });
        //2. call the file service to save files link to db
        if (uploadedCloudFiles.length > 0) {
          await this.fileService.saveFileRecordsToDB(
            user.id,
            uploadedCloudFiles,
            tx,
            newPost.id,
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

      //trigger notification
      if (result) {
        //get all approver
        const postApprovers = await this.prismaService.groupMember.findMany({
          where: {
            groupId,
            OR: [{ role: GroupRole.OWNER }, { canApprovePost: true }],
          },
        });
        const approverIds = postApprovers.filter(
          (approver) => approver.userId !== userId,
        );
        const NotificationData = approverIds.map((approverId) => {
          return new NotificationEvents({
            senderId: userId,
            receiverId: approverId.userId,
            type: NotificationType.GROUP_POST_PENDING_REQUEST,
            groupId,
          });
        });
        this.eventEmitter.emit('notifications.createMany', NotificationData);
      }
      return result;
    } catch (error) {
      if (uploadedCloudFiles.length > 0) {
        const publicIds = uploadedCloudFiles.map((file) => file.publicId);
        await this.fileService.deleteFilesFromCloud(publicIds);
      }
      console.log('create post error: ', error);
      throw new InternalServerErrorException(
        'Create post failed, please try again',
      );
    }
  }
  //get all posts
  async getAllPosts(user: JwtUser, page = 1, limit = 10) {
    const skip = limit * (page - 1);
    const includeComment = {
      where: { parentId: null },
      take: 5,
      include: {
        file: true,
        user: { select: { id: true, fullname: true } },
        _count: { select: { replies: true } },
      },
    };
    //for admin
    if (user && user.role === 'ADMIN') {
      const [posts, total] = await Promise.all([
        this.prismaService.post.findMany({
          include: {
            files: true,
            category: true,
            createdBy: true,
            comments: includeComment,
            originalPost: {
              include: {
                createdBy: {
                  select: { id: true, fullname: true, avatar: true },
                },
                files: true,
                category: true,
              },
            },
            _count: {
              select: {
                comments: true,
                likes: true,
              },
            },
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
    const whereCondition = {
      OR: [
        { privacy: Privacy.PUBLIC },
        ...(user ? [{ createdById: user.id }] : []),
        ...(followingIds.length > 0
          ? [{ privacy: Privacy.FOLLOWER, createdById: { in: followingIds } }]
          : []),
      ],
    };
    const [posts, total] = await Promise.all([
      this.prismaService.post.findMany({
        where: whereCondition,
        include: {
          category: true,
          files: true,
          createdBy: true,
          comments: includeComment,
          _count: { select: { comments: true, likes: true } },
          originalPost: {
            include: {
              createdBy: { select: { id: true, fullname: true, avatar: true } },
              files: true,
              category: true,
            },
          },
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
        total: total,
        page,
        limit,
        totalPage: Math.ceil(total / limit),
      },
    };
  }
  //get posts for guess (only public posts)
  async getAllPublicPostsForGuess(page: number, limit: number) {
    const includeComment = {
      where: { parentId: null },
      take: 5,
      include: {
        file: true,
        user: { select: { id: true, fullname: true } },
        _count: { select: { replies: true } },
      },
    };
    const whereCondition = { privacy: Privacy.PUBLIC };
    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
      this.prismaService.post.findMany({
        where: whereCondition,
        include: {
          files: true,
          category: true,
          createdBy: true,
          comments: includeComment,
          _count: { select: { comments: true, likes: true } },
          originalPost: {
            include: {
              category: true,
              files: true,
              createdBy: { select: { id: true, fullname: true, avatar: true } },
            },
          },
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
  //get post by id
  async getPostById(user: JwtUser, id: number) {
    const includeComment = {
      where: { parentId: null },
      orderBy: { createdAt: 'desc' as const },
      take: 10,
      include: {
        file: true,
        user: { select: { id: true, fullname: true } },
        _count: { select: { replies: true } },
      },
    };
    const role = user.role;
    const userId = Number(user.id);
    const post = await this.prismaService.post.findUnique({
      where: { id },
      include: {
        files: true,
        createdBy: true,
        category: true,
        comments: includeComment,
        _count: { select: { comments: true, likes: true } },
        originalPost: {
          include: {
            category: true,
            files: true,
            createdBy: { select: { id: true, fullname: true, avatar: true } },
          },
        },
      },
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
            user.id,
            uploadedFiles,
            tx,
            postId,
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
      include: {
        files: true,
        category: true,
        createdBy: true,
        comments: { include: { file: true } },
      },
    });
    if (!post) throw new NotFoundException('post not found');
    if (Number(user.id) !== post.createdById && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You can not delete this post');
    }
    //collect all publicIds from post
    const postPublicIds = post.files
      .map((file) => file.publicId)
      .filter((id): id is string => Boolean(id));
    //collect all publicIds from comments
    const commentPublicIds = post.comments
      .map((comment) => comment.file?.publicId)
      .filter((id): id is string => Boolean(id));
    //join 2 map together
    const allPublicIds = [...postPublicIds, ...commentPublicIds];

    try {
      //1. delete post record

      await this.prismaService.post.delete({ where: { id: postId } });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('can not delete this post');
    }
    //2. delete files from cloud
    try {
      if (allPublicIds && allPublicIds.length > 0)
        await this.fileService.deleteFilesFromCloud(allPublicIds);
    } catch (error) {
      console.log('delete post files error', error);
      // throw new InternalServerErrorException(
      //   'can not delete related files from cloud',
      // ); <== no need to throw this exception, avoid misunderstanding from users
    }
    return { message: 'post deleted' };
  }

  //delete posts
  async deletePosts(user: JwtUser, ids: number[]) {
    const posts = await this.prismaService.post.findMany({
      where: { id: { in: ids } },
      include: {
        files: true,
        category: true,
        createdBy: true,
        comments: { include: { file: true } },
      },
    });
    if (posts.length === 0) throw new NotFoundException('Posts not found');
    //xu ly authorization
    const isAdmin = user.role === Role.ADMIN;
    const isNotAuthor = posts.filter(
      (post) => Number(post.createdById) !== Number(user.id),
    );
    if (!isAdmin && isNotAuthor.length > 0)
      throw new ForbiddenException(
        'Only admin or the posts owner can delete multiple posts',
      );

    try {
      await this.prismaService.post.deleteMany({ where: { id: { in: ids } } });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('can not delete those posts');
    }
    //delete files from cloud
    try {
      const postPublicIds = posts
        .flatMap((post) => post.files)
        .map((file) => file.publicId);

      const commentPublicIds = posts
        .flatMap((post) => post.comments)
        .map((comment) => comment.file?.publicId);

      const publicIds = [...postPublicIds, ...commentPublicIds].filter(
        (id): id is string => Boolean(id),
      );
      if (publicIds.length > 0)
        await this.fileService.deleteFilesFromCloud(publicIds);
    } catch (error) {
      console.log('from delete post/file', error);
    }

    return { mesage: 'posts deleted' };
  }

  //share post
  async sharePost(user: JwtUser, body: SharePostDto, originalPostId: number) {
    const userId = Number(user.id);
    const originalPost = await this.prismaService.post.findUnique({
      where: { id: originalPostId },
      include: { files: true, createdBy: true, category: true },
    });
    if (!originalPost)
      throw new NotFoundException(
        'The post you are sharing is not available or has been removed',
      );
    if (originalPost.groupId) {
      const group = await this.prismaService.group.findUnique({
        where: { id: originalPost.groupId },
      });
      if (!group) throw new NotFoundException('group not found');
      if (group.privacy === GroupPrivacy.PRIVATE)
        throw new ForbiddenException(
          'You can not share a post from a Private Group',
        );
    }
    const originalId = originalPost.originalPostId ?? originalPostId;
    const newSlug = `${originalPost.slug}-share-${Date.now()}`;
    const sharedPost = await this.prismaService.post.create({
      data: {
        content: body.content || '',
        title: originalPost.title,
        slug: newSlug,
        originalPostId: originalId,
        createdById: userId,
        categoryId: originalPost.categoryId,
        privacy: body.privacy ?? Privacy.PUBLIC,
      },
      include: {
        createdBy: { select: { id: true, avatar: true, fullname: true } },
        originalPost: {
          include: {
            files: true,
            category: true,
            createdBy: { select: { id: true, avatar: true, fullname: true } },
          },
        },
      },
    });
    // 3. Bắn event tạo thông báo (nếu người share KHÔNG PHẢI tác giả bài gốc)
    if (originalPost.createdById !== userId) {
      this.eventEmitter.emit(
        'notification.create',
        new NotificationEvents({
          senderId: userId,
          receiverId: originalPost.createdById,
          type: NotificationType.SHARE,
        }),
      );
    }

    return {
      sharedPost,
    };
  }

  //group posts handling
  //get pending post
  async getPendingPosts(user: JwtUser, groupId: number) {
    const userId = Number(user.id);
    const userInGroup = await this.prismaService.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });
    if (!userInGroup) throw new ForbiddenException('You are not in this group');
    if (userInGroup.role !== GroupRole.OWNER && !userInGroup.canApprovePost) {
      throw new ForbiddenException(
        'You do not have permission to see pending posts',
      );
    }
    return this.prismaService.post.findMany({
      where: { groupId, status: PostStatus.PENDING },
    });
  }

  //approve post
  async approvePost(user: JwtUser, postId: number, groupId: number) {
    const userId = Number(user.id);
    const userInGroup = await this.prismaService.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });
    if (!userInGroup) {
      throw new ForbiddenException('You are not in this group');
    }
    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
      include: { createdBy: { select: { id: true } } },
    });
    if (!post)
      throw new NotFoundException(
        'Post not found or was rejected by other moderator',
      );

    if (post.groupId !== groupId) {
      throw new ForbiddenException('This post does not belong to this group');
    }
    if (
      post.status === PostStatus.PUBLISHED ||
      post.status === PostStatus.REJECTED
    ) {
      throw new BadRequestException('This post has been approved or deleted');
    }
    if (userInGroup.role !== GroupRole.OWNER && !userInGroup.canApprovePost) {
      throw new ForbiddenException(
        'You do not have permission to approve posts',
      );
    }
    const approvedPost = await this.prismaService.post.update({
      where: {
        id: postId,
      },
      data: { status: PostStatus.PUBLISHED },
    });
    if (approvedPost) {
      this.eventEmitter.emit(
        'notification.create',
        new NotificationEvents({
          senderId: userId,
          postId,
          groupId,
          type: NotificationType.GROUP_POST_APPROVE,
          receiverId: post.createdById,
        }),
      );
    }
    return approvedPost;
  }

  //reject post
  async rejectPost(user: JwtUser, postId: number, groupId: number) {
    const userId = Number(user.id);
    const userInGroup = await this.prismaService.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });
    if (!userInGroup) throw new ForbiddenException('You are not in this group');
    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.groupId !== groupId)
      throw new BadRequestException('This post does not belong to this group');
    if (post.status !== PostStatus.PENDING) {
      throw new BadRequestException('This post has already been processed');
    }
    if (userInGroup.role !== GroupRole.OWNER && !userInGroup.canApprovePost)
      throw new ForbiddenException(
        'You do not have permission to reject a post',
      );
    return this.prismaService.post.update({
      where: { id: postId },
      data: { status: PostStatus.REJECTED },
    });
  }

  //get group posts
  async getGroupPosts(user: JwtUser, groupId: number, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const userId = Number(user.id);
    const userInGroup = await this.prismaService.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
      include: { group: true },
    });
    const group = await this.prismaService.group.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('group not exist');
    if (!userInGroup && group?.privacy === GroupPrivacy.PRIVATE)
      throw new ForbiddenException('Only member can see posts in this group');
    const posts = await this.prismaService.post.findMany({
      where: { groupId, status: PostStatus.PUBLISHED },
      include: {
        files: true,
        comments: {
          take: 5,
          include: {
            user: { select: { avatar: true, fullname: true, id: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        createdBy: { select: { id: true, fullname: true, avatar: true } },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { isPinned: 'desc' }],
      skip,
      take: limit,
    });
    const total = await this.prismaService.post.count({
      where: { groupId, status: PostStatus.PUBLISHED },
    });
    const numOfPages = Math.ceil(total / limit);
    return { posts, page, limit, total, numOfPages };
  }

  //toggle pin a post
  async togglePinPost(user: JwtUser, groupId: number, postId: number) {
    const userId = Number(user.id);
    const userInGroup = await this.prismaService.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!userInGroup) throw new ForbiddenException('You are not in this group');
    if (userInGroup.role !== GroupRole.OWNER && !userInGroup.canPinPost)
      throw new ForbiddenException('You do not have permission to pin a post');
    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.status === PostStatus.PENDING)
      throw new ForbiddenException('You have to approve this post first');
    if (post.groupId !== groupId)
      throw new BadRequestException('This post is not in this group');
    const newIsPinned = post.isPinned ? false : true;
    return this.prismaService.post.update({
      where: { id: postId, groupId },
      data: { isPinned: newIsPinned },
    });
  }

  //delete group post
  async deleteGroupPost(user: JwtUser, postId: number, groupId: number) {
    const userId = Number(user.id);
    const userInGroup = await this.prismaService.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });
    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (!userInGroup) throw new ForbiddenException('You are not in this group');
    if (
      userInGroup.role !== GroupRole.OWNER &&
      !userInGroup.canDeletePost &&
      post.createdById !== userId
    )
      throw new ForbiddenException(
        'You have no permission to delete this post',
      );
    if (post.groupId !== groupId)
      throw new ForbiddenException('this post does not belong to this group');

    return this.prismaService.post.delete({ where: { id: postId, groupId } });
  }
}
