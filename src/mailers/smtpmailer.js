const nodemailer = require("nodemailer");

class SMTPMailer {
  constructor(options) {
    this.options = options;

    const { from, nodemailer, mapToContent } = options;

    if(!mapToContent) {
      throw new Error(
`
No mapToContent function specified.
Please provide a function with the following signature through options:
new Mailer({
  mapToContent : (type : string, options : any ) => {subject : string, text : string, html : string}
});
`
      );
    }

    if(!nodemailer) {
      throw new Error(
        `
No nodemailer arguments.
Please provide the nodemailer object via options to be provided to nodemailer.createTransport`
      );
    }

    if(!from) {
      throw new Error('Missing from option');
    }

    this.mapToContent = mapToContent;
  }

  async send(content, to) {
    const transporter = nodemailer.createTransport(this.options.nodemailer);

    return transporter.sendMail({
      from : this.options.from,
      to,
      subject : content.subject,
      text : content.text,
      html : content.html
    })
  }

  async sendLostPassword(to, options) {
    return this.send(this.mapToContent('lostPassword', options), to);
  }

  async sendWelcome(to, options) {
    return this.send(this.mapToContent('welcome', options), to);
  }

  async sendPasswordlessCode(to, options) {
    return this.send(this.mapToContent('passwordless', options), to);
  }
}


module.exports = SMTPMailer;
