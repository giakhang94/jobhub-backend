import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';
import { FileType } from '../../generated/prisma/enums.js';
import { CloudinaryResponse } from './cloudinary-response.js';
import { CLOUDINARY } from './cloudinary/cloudinary.js';

@Injectable()
export class CloudinaryService {
  constructor(
    @Inject(CLOUDINARY) private readonly cloudinaryInstance: typeof cloudinary,
  ) {}

  //upload files to cloudinary
  async uploadFiles(
    files: Express.Multer.File[],
  ): Promise<CloudinaryResponse[]> {
    const uploader = cloudinary.uploader;
    if (!files || files.length === 0) return [];
    const uploadPromises = files.map((file) => {
      return new Promise<any>((resolve, reject) => {
        const uploadStream = uploader.upload_stream(
          {
            folder: 'jobhub',
            // upload_preset: 'ml_default',
            resource_type: 'auto',
          },
          (error, result) => {
            if (error) return reject(error);

            const fileType = file.mimetype.startsWith('image/')
              ? FileType.IMAGE
              : FileType.DOCUMENT;

            resolve({
              url: result?.secure_url,
              publicId: result?.public_id,
              originalName: file.originalname,
              mimeType: file.mimetype,
              fileType: fileType,
            });
          },
        );
        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });
    });
    try {
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.log('cloudinary service', error);
      throw new InternalServerErrorException(
        'Error when uploading file to cloud',
      );
    }
  }
  //delete files
  async deleteFiles(publicIds: string[]) {
    if (!publicIds || publicIds.length === 0) return;
    try {
      const deletePromises = publicIds.map((publicId: string) =>
        cloudinary.uploader.destroy(publicId),
      );
      await Promise.all(deletePromises);
      console.log('delete files successfully for rolling back');
    } catch (error) {
      console.log('looxi gfi day', error);
      console.log('Can not delete file from cloud');
    }
  }
}
