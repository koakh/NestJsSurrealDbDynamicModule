import { IsString } from 'class-validator';

export class IncrementUserDto {
  @IsString()
  username: string;
}
