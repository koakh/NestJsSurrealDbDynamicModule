import { IsIn, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateDto {
  // the document / record data, or a JSON Patch array when mode is `patch`
  @IsNotEmpty()
  data: any;

  // `content` (default, replace), `merge` or `patch`
  @IsIn(['content', 'merge', 'patch'])
  @IsOptional()
  mode?: 'content' | 'merge' | 'patch';
}
