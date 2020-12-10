class Mailer {
  constructor(options) {
    this.options = options;
  }

  async sendLostPassword(to, options) {
    const message = `No mailer specified! Unable to send lost password email to ${to}`;

    console.error(message);
    throw new Error(message);
  }

  async sendWelcome(to, options) {
    const message = `No mailer specified! Unable to send welcome email to ${to}`;

    console.error(message);
    throw new Error(message);
  }

  async sendPasswordlessCode(to, options) {
    const message = `No mailer specified! Unable to send passworless login code to ${to}`;

    console.error(message);
    throw new Error(message);
  }
}


module.exports = Mailer;
