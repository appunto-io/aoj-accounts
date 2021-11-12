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

export declare class Mailer {
  constructor(options : any);
  async send(templateId : string | number, to : string, params ?: Record<string, string>) : Promise<true | undefined>;
  async sendLostPassword(to : string, options ?: SibSendOptions) : Promise<true | undefined>;
  async sendWelcome(to : string, options ?: SibSendOptions) : Promise<true | undefined>;
  async sendPasswordlessCode(to : string, options ?: SibSendOptions) : Promise<true | undefined>;
}

export declare class SibMailer extends Mailer {
  constructor(options : SibMailerOptions)
}
export declare class TestMailer extends Mailer {}

export declare type SibMailerOptions = {
  apiKey : string;
  mapTemplateId : (type : string, options ?: SibSendOptions) => number;
}
export declare type SibSendOptions = {
  data ?: Record<string, string>;
}