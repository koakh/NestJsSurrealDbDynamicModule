import { RecordId, StringRecordId } from 'surrealdb';

export type RecordId$1<Tb extends string = string> = RecordId<Tb> | StringRecordId;