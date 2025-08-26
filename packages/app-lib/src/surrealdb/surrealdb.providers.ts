import { SURREALDB_MODULE_OPTIONS, SURREALDB_MODULE_USER_SERVICE } from './surrealdb.constants';
import { SurrealDbModuleOptions } from './surrealdb.interfaces';

export const createNestSurrealDbModuleProviders = [
  // this is required, seems that only passed from appModule services
  // are required here too be a SurrealDb Providers userService and appService
  {
    inject: [SURREALDB_MODULE_OPTIONS],
    provide: SURREALDB_MODULE_USER_SERVICE,
    useFactory: async (surrealDbModuleOptions: SurrealDbModuleOptions) => {
      return surrealDbModuleOptions.userService;
    },
  },
];
