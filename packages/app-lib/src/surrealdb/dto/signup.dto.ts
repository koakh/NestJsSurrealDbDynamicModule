import { IsObject, IsOptional, IsString } from 'class-validator';

export declare class SignupDto {
  // The namespace to sign up to
  @IsString()
  namespace: string;

  // The database to sign up to
  @IsString()
  database: string;

  // The access to sign up to. Also pass any variables used in the access
  @IsString()
  access: string;

  @IsOptional()
  @IsObject()
  // Also pass any properties required by the access definition
  variables?: { [key: string]: any };
}
