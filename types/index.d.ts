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
  async send(templateId : string | number, to : string, params ?: SendOptionsData) : Promise<true | undefined>;
  async sendLostPassword(to : string, options ?: SibSendOptions) : Promise<true | undefined>;
  async sendWelcome(to : string, options ?: SibSendOptions) : Promise<true | undefined>;
  async sendPasswordlessCode(to : string, options ?: SibSendOptions) : Promise<true | undefined>;
}

export declare class SibMailer extends Mailer {
  constructor(options : SibMailerOptions);
  mapTemplateId : (type : string, options ?: SibSendOptions) => number;
}
export declare class TestMailer extends Mailer {}

export declare type SibMailerOptions = {
  apiKey : string;
  mapTemplateId : (type : string, options ?: SibSendOptions) => number;
}
export declare type SibSendOptions = {
  data ?: SendOptionsData;
}

type SendOptionsData = {
  [key : string] : string | number | undefined | SendOptionsData;
}

export declare class SMTPMailer extends Mailer {
  constructor(options : SMTPMailerOptions);
}

export declare type SMTPMailerOptions = {
  from : string;
  mapToContent : SMTPMapToContent;
  nodemailer : {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  }
}

export declare type SMTPMapToContent = (type : string, options : any) => SMTPContent;
export declare type SMTPContent = {
  subject : string,
  text : string,
  html : string
}