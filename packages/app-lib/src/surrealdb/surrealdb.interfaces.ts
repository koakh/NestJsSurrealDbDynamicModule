import type { ConnectOptions } from 'surrealdb';
import { UserServiceAbstract } from './surrealdb.abstracts';

/**
 * opt-in request guard for `SurrealDbController` endpoints
 *
 * receives the raw HTTP request, return `true` (or nothing) to allow,
 * `false` to reject with 403, or throw any `HttpException` for a custom response
 */
export type SurrealDbControllerGuardFn = (request: any) => boolean | void | Promise<boolean | void>;

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
  /**
   * opt-in request guard applied to every `SurrealDbController` endpoint.
   * the controller exposes the full SDK surface over REST (query, import, export, ...),
   * use this to protect it when the endpoints are reachable by untrusted parties
   */
  controllerGuard?: SurrealDbControllerGuardFn;
  // surrealdb.js v2 `ConnectOptions` passthrough (all optional)
  // https://surrealdb.com/docs/reference/javascript/api/types/#connectoptions
  reconnect?: ConnectOptions['reconnect'];
  retry?: ConnectOptions['retry'];
  renewAccess?: boolean;
  versionCheck?: boolean;
}
