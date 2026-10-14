import { EnvironmentVariables } from '../interfaces';

export const configuration = (): EnvironmentVariables => ({
  graphqlServerPort: process.env.GRAPHQL_SERVER_PORT || '3030',
  graphqlAutoSchemaFile: process.env.GRAPHQL_AUTO_SCHEMA_FILE || './schema.gql',
  surrealDbUrl: process.env.SURREALDB_URL || 'ws://127.0.0.1:8001/rpc',
  surrealDbNamespace: process.env.SURREALDB_NAMESPACE || 'test',
  surrealDbDatabase: process.env.SURREALDB_DATABASE || 'test',
  surrealDbUsername: process.env.SURREALDB_USERNAME || 'root',
  surrealDbPassword: process.env.SURREALDB_PASSWORD || 'root',
});
