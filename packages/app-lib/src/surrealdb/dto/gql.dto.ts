import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export declare class GqlDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsObject()
  @IsOptional()
  variables?: { [key: string]: any };
}
