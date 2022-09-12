import { ArgsType, Field, Int } from '@nestjs/graphql';
import { Max, Min } from 'class-validator';

// TODO: baseClass
@ArgsType()
export class RecipesArgs {
  @Field(() => Int)
  @Min(0)
  skip = 0;

  @Field(() => Int)
  // TODO: class-validator put in use with new ValidationPipe()
  @Min(1)
  @Max(50)
  take = 25;
}
