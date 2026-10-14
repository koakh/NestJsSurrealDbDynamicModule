import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export declare class RelateDto {
  @IsString()
  @IsOptional()
  from?: string;

  @IsArray()
  @IsOptional()
  fromMany?: string[];

  @IsString()
  to: string;

  @IsArray()
  @IsOptional()
  toMany?: string[];

  @IsObject()
  @IsOptional()
  data?: any;
}
