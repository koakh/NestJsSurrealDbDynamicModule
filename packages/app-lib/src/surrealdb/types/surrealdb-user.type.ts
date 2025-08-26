import { RecordId$1 } from './record-id$1.type';

// Your original User type (for API/business logic)
// tslint:disable-next-line:interface-over-type-literal
export type SurrealDbUser = {
  id: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roles: string[];
  createdDate: number;
  createdBy?: string;
  metaData: any;
};

// SurrealDB-compatible User type
export type SurrealDbUserSurrealType = Omit<SurrealDbUser, 'id'> & {
  id: RecordId$1<string>;
};

// Simplified generic helper - always adds RecordId regardless of original id type
export type WithSurrealId<T> = Omit<T, 'id'> & { id: RecordId$1<string> };

// Helper for input data (without id)
export type SurrealInput<T> = Omit<T, 'id'>;
