import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

const attachCookie = (
  res: Response,
  tokenName: string,
  token: string,
  exp: string,
  configService: ConfigService,
  httpOnly = true,
) => {
  const secure = configService.get<string>('NODE_ENV') === 'production';
  const expsIn = Number(exp.slice(0, -1)) * 60 * 60 * 1000;

  res.cookie(tokenName, token, { secure, httpOnly, maxAge: expsIn });
};

export { attachCookie };
