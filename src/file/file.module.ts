import { Module } from '@nestjs/common';
import { FileService } from './file.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';

@Module({
  providers: [FileService],
  imports: [PrismaModule, CloudinaryModule],
  exports: [FileService],
})
export class FileModule {}
