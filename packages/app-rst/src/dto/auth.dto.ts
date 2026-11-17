import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DbSignupDto {
  @IsString()
  @IsNotEmpty()
  readonly username: string;

  @IsString()
  @IsNotEmpty()
  readonly password: string;

  @IsBoolean()
  @IsOptional()
  readonly marketing?: boolean;

  @IsArray()
  @IsOptional()
  readonly tags?: string[];
}

export class DbSigninDto {
  @IsString()
  @IsNotEmpty()
  readonly username: string;

  @IsString()
  @IsNotEmpty()
  readonly password: string;
}
