import { IsObject, IsOptional, IsString } from 'class-validator';

export class SigninDto {
  // system user credentials (root, namespace or database user)
  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  password?: string;

  // record access authentication
  @IsString()
  @IsOptional()
  namespace?: string;

  @IsString()
  @IsOptional()
  database?: string;

  // the access method to sign in to, also pass any variables used in the access
  @IsString()
  @IsOptional()
  access?: string;

  @IsObject()
  @IsOptional()
  variables?: { [key: string]: any };
}
