import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  FileType,
  PostStatus,
  Privacy,
} from '../../../generated/prisma/enums.js';

// Class phụ để validate thông tin các file đính kèm (nếu có)
class FileAttachmentDto {
  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsString()
  @IsOptional()
  publicId?: string;

  @IsString()
  @IsNotEmpty()
  originalName!: string;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @IsEnum(FileType)
  fileType!: FileType;
}

export class CreatePostDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  title!: string;

  @IsString()
  @IsNotEmpty({ message: 'Slug không được để trống' })
  slug!: string;

  @IsString()
  @IsNotEmpty({ message: 'Nội dung bài viết không được để trống' })
  content!: string;

  @IsEnum(PostStatus, { message: 'Trạng thái bài viết không hợp lệ' })
  @IsOptional()
  status?: PostStatus;

  @Transform(({ value }) => Number(value))
  @IsInt({ message: 'categoryId phải là số nguyên' })
  @IsNotEmpty({ message: 'Danh mục bài viết là bắt buộc' })
  categoryId!: number;

  @IsOptional()
  @IsEnum(Privacy)
  privacy?: Privacy;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  groupId?: number;
}
