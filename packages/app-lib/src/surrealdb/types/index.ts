// re-export the most useful surrealdb.js v2 value classes and types,
// so consumers don't need to depend on `surrealdb` directly
export { RecordId, RecordIdRange, StringRecordId, Table, Uuid, surql, Features } from 'surrealdb';
export type {
  AccessRecordAuth,
  AnyAuth,
  ConnectionStatus,
  LiveResource,
  NamespaceDatabase,
  SqlExportOptions,
  Tokens,
  VersionInfo,
} from 'surrealdb';
export * from './surrealdb-user.type';
export * from './record-id$1.type';
