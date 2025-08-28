import { UserServiceAbstract } from './surrealdb.abstracts';

export interface SurrealDbModuleOptions {
  url: string;
  namespace: string;
  database: string;
  username: string;
  password: string;
  userService?: UserServiceAbstract;
  // this will be used to prevent consumer apps to init surrealdb, ex when micropal is disabled and to prevent c3-backend to crash on boot
  initSurrealDb?: boolean;
  // this will be used to prevent throw error on consumer apps, ex when micropal is enabled and surrealdb is offline by some unknown reason to prevent c3-backend to crash on boot
  initSurrealDbThrowError?: boolean;
  surrealdbReconnectTimeoutInterval: number;
}
