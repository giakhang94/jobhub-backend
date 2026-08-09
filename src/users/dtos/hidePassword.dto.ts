import { Exclude } from 'class-transformer';

export class HidePasswordDto {
  id!: number;
  email!: string;
  fullname!: string;

  @Exclude()
  password!: string;

  @Exclude()
  refreshTokenHash!: string;
}
