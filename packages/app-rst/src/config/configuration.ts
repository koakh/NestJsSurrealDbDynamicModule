import { EnvironmentVariables } from '../interfaces';

export const configuration = (): EnvironmentVariables => ({
  httpServerPort: process.env.HTTP_SERVER_PORT || '3030',
  surrealDbUrl: process.env.SURREALDB_URL || 'ws://127.0.0.1:8001/rpc',
  surrealDbNamespace: process.env.SURREALDB_NAMESPACE || 'test',
  surrealDbDatabase: process.env.SURREALDB_DATABASE || 'test',
  surrealDbUsername: process.env.SURREALDB_USERNAME || 'root',
  surrealDbPassword: process.env.SURREALDB_PASSWORD || 'root',
  // when set, every SurrealDbController endpoint requires the `x-api-key` header to match
  surrealDbControllerGuardKey: process.env.SURREALDB_CONTROLLER_GUARD_KEY,
  // set to "false" to skip the automatic connect on boot (ex when surrealdb is disabled)
  surrealDbInitSurrealDb: process.env.SURREALDB_INIT_SURREAL_DB,
  // set to "false" to log-and-continue when the connection fails at boot, instead of crashing the app
  surrealDbInitSurrealDbThrowError: process.env.SURREALDB_INIT_SURREAL_DB_THROW_ERROR,
});
