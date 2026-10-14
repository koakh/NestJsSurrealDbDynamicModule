import { IsNotEmpty, IsString } from 'class-validator';

export declare class SetDto {
  // the name of the variable (without the $ prefix)
  @IsString()
  @IsNotEmpty()
  variable: string;

  // the value to assign to the variable name
  @IsNotEmpty()
  value: any;
}
