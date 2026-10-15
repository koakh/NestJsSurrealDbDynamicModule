import { IsString } from 'class-validator';

export class AddUserDto {
  @IsString()
  username: string;
}
