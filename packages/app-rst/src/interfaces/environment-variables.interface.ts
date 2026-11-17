export interface EnvironmentVariables {
  httpServerPort: string;
  surrealDbUrl: string;
  surrealDbNamespace: string;
  surrealDbDatabase: string;
  surrealDbUsername: string;
  surrealDbPassword: string;
  surrealDbControllerGuardKey?: string;
  surrealDbInitSurrealDb?: string;
  surrealDbInitSurrealDbThrowError?: string;
}
