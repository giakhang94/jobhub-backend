import { IsNotEmpty, IsNumber } from 'class-validator';

export class FollowDto {
  @IsNumber()
  @IsNotEmpty()
  following!: number;
}
