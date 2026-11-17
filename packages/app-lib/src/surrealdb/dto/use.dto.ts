import { IsString } from 'class-validator';

export class UseDto {
  @IsString()
  namespace: string;

  @IsString()
  database: string;
}
