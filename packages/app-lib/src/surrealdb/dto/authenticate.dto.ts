import { IsJWT, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export declare class AuthenticateDto {
  // the access token
  @IsString()
  @IsNotEmpty()
  token: string;

  // optional refresh token, when set the SDK exchanges it for a new token pair
  @IsString()
  @IsOptional()
  refresh?: string;
}
