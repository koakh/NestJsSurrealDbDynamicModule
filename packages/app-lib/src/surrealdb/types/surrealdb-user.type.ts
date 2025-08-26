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
