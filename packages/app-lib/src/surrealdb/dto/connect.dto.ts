import { IsNotEmpty, IsString, Matches } from 'class-validator';

// scheme allowlist of the surrealdb.js v2 connection engines, blocks
// `file://` and arbitrary schemes while allowing every legit endpoint
const CONNECTION_URL_SCHEMES = /^(ws|wss|http|https|mem|rocksdb|surrealkv|fdb|tikv):/i;

export class ConnectDto {
  @IsString()
  @IsNotEmpty()
  @Matches(CONNECTION_URL_SCHEMES)
  url: string;
}
