import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class QueryDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsObject()
  @IsOptional()
  bindings?: { [key: string]: any };

  // `collect` (default), `json`, `responses` or `stream`
  @IsString()
  @IsIn(['collect', 'json', 'responses', 'stream'])
  @IsOptional()
  mode?: 'collect' | 'json' | 'responses' | 'stream';
}
