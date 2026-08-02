import { PrismaService } from '../prisma/prisma.service.js';
import { Injectable } from '@nestjs/common';
import { FileType } from '../../generated/prisma/enums.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class FileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  //upload files to cloud
  async uploadFilesToCloud(files: Express.Multer.File[]) {
    return this.cloudinaryService.uploadFiles(files);
  }

  async saveFileRecordsToDB(
    postId: number,
    uploaderId: number,
    filesData: Array<{
      url: string;
      publicId?: string;
      originalName: string;
      mimeType: string;
      fileType: FileType;
    }>,
    tx: Prisma.TransactionClient | PrismaService = this.prisma, //transaction passed from postService (from outside)
  ) {
    if (!filesData || filesData.length === 0) return;

    return tx.file.createMany({
      data: filesData.map((file) => ({
        url: file.url,
        publicId: file.publicId ?? null, //make sure publicId can't be undefined
        originalName: file.originalName,
        mimeType: file.mimeType,
        fileType: file.fileType,
        uploaderId: uploaderId,
        postId: postId,
      })),
    });
  }
  //delete files from cloud
  async deleteFilesFromCloud(publicIds: string[]) {
    // console.log('file service', publicIds);
    try {
      return this.cloudinaryService.deleteFiles(publicIds);
    } catch (error) {
      console.log('delete file error', error);
    }
  }
}
