import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service.js';
import { CloudinaryProvider } from './cloudinary/cloudinary.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  providers: [CloudinaryService, CloudinaryProvider],
  imports: [ConfigModule],
  exports: [CloudinaryService, CloudinaryProvider],
})
export class CloudinaryModule {}
