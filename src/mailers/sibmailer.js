const SibApiV3Sdk = require('sib-api-v3-sdk');


class Mailer {
  constructor(options) {
    this.options = options;

    const { apiKey, mapTemplateId } = options;

    if(!mapTemplateId) {
      throw new Error(
`
No mapTemplateId function specified.
Please provide a function with the following signature through options:
new Mailer({
  mapTemplateId : (type : string, options : any ) => number
});
`
      );
    }

    this.mapTemplateId = mapTemplateId;

    // Configure Sib SDK
    this.defaultClient = SibApiV3Sdk.ApiClient.instance;
    this.apiKey        = this.defaultClient.authentications['api-key'];
    this.apiKey.apiKey = apiKey;
    this.apiInstance   = new SibApiV3Sdk.TransactionalEmailsApi();
  }

  /*
    Generic email sending utility function
  */
  async send(templateId, to, params = {}) {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    const sendSmtpEmailTo = new SibApiV3Sdk.SendSmtpEmailTo();
    sendSmtpEmailTo.email = to;

    sendSmtpEmail.to = [sendSmtpEmailTo];
    sendSmtpEmail.templateId = templateId;
    sendSmtpEmail.params = params;

    try {
      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
    }
    catch(error) {
      console.error(error);
      throw new Error(`Unable to send email with templateId ${templateId} to user '${to}'`);
    }

    return true;
  }

  async sendLostPassword(to, options = {}) {
    return this.send(this.mapTemplateId('lostPassword', options), to, options.data || {});
  }

  async sendWelcome(to, options) {
    return this.send(this.mapTemplateId('welcome', options), to, options.data || {});
  }

  async sendPasswordlessCode(to, options) {
    return this.send(this.mapTemplateId('passwordless', options), to, options.data || {});
  }
}


module.exports = Mailer;
