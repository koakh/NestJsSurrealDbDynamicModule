import { IsNotEmpty } from 'class-validator';

export class DataDto {
  @IsNotEmpty()
  data: any;
}
