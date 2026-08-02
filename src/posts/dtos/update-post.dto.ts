import { PartialType } from '@nestjs/mapped-types';
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

import { Transform } from 'class-transformer';
import { CreatePostDto } from './create-post.dto.js';

export class UpdatePostDto extends PartialType(CreatePostDto) {
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    // Đảm bảo parse mảng ID file cũ muốn giữ lại (nếu client gửi dạng chuỗi JSON hoặc array)
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return value;
  })
  @IsInt({ each: true, message: 'ID file phải là số nguyên' })
  keptFileIds?: number[]; // Danh sách ID các file cũ muốn giữ lại
}
