import { Prisma } from '../../../generated/prisma/client.js';

export type JwtUser = Prisma.UserGetPayload<{
  select: {
    id: true;
    role: true;
    fullname: true;
    email: true;
    status: true;
  };
}>;
