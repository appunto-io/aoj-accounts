import { ApiModel, Database, DataModel } from "@appunto/api-on-json";

export declare function createAccountsApiModel(options?: {
  email        ?: boolean;
  facebook     ?: boolean;
  google       ?: boolean;
  linkedin     ?: boolean;
  passwordLess ?: boolean;
}): { dataModel: DataModel; apiModel: ApiModel };

export declare function createRootAccount(
  db            : Database,
  email         : string,
  password      : string,
  options?      : {rootRole? : string;}
): null | string;