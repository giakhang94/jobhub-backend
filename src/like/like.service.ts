import { JwtUser } from '../auth/interfaces/jwt-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class LikeService {
  constructor(private readonly prismaService: PrismaService) {}

  //toggle like
  async toggleLike(user: JwtUser, postId: number) {
    const userId = Number(user.id);
    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('post not found');
    //kiem tra co like chua
    const isLiked = await this.prismaService.like.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });
    //try-catch for toggle like
    try {
      if (isLiked) {
        //unlike
        const unlike = await this.prismaService.like.delete({
          where: {
            userId_postId: {
              userId,
              postId,
            },
          },
        });
        if (unlike) return { message: 'unliked', isLiked: false };
      } else {
        //like
        const like = await this.prismaService.like.create({
          data: {
            postId,
            userId,
          },
        });

        return { message: 'you liked this post', isLiked: true };
      }
    } catch (error) {
      console.log('error from like', error);
      throw new InternalServerErrorException(
        'can not toggle like, please try again',
      );
    }
  }
}
