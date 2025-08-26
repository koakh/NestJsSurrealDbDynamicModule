import { CurrentUserPayload } from './interfaces';
import { SurrealDbUser as SurrealDbUser } from './types';

export abstract class AppServiceAbstract {
  abstract getHello(): string;
}

// tslint:disable-next-line:max-classes-per-file
export abstract class UserServiceAbstract {
  abstract findOneByField(key: string, value: string, currentUser?: CurrentUserPayload): Promise<SurrealDbUser>;
}
