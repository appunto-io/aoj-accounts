class Mailer {
  constructor(options) {
    this.options = options;
  }

  async sendLostPassword(to, options) {
    const message = `TEST MAILER: password lost email sent to ${to} with options: `;

    console.log(message, JSON.stringify(options, null, 2));
    return true;
  }

  async sendWelcome(to, options) {
    const message = `TEST MAILER: welcome email sent to ${to} with options: `;

    console.log(message, JSON.stringify(options, null, 2));
    return true;
  }

  async sendPasswordlessCode(to, options) {
    const message = `TEST MAILER: passwordless login code sent to ${to} with options: `;

    console.log(message, JSON.stringify(options, null, 2));
    return true;
  }
}


module.exports = Mailer;
