const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const LocaleCode = require('locale-code');
const nodemailer = require('nodemailer');
const mailgunTransport = require('nodemailer-mailgun-transport');
const handlebars = require('handlebars');
const isPlainObject = require('lodash.isplainobject');
const passwordGenerator = require('generate-password');

const VoidMailer = require('../mailers/voidmailer');
const voidMailer = new VoidMailer();

const saltRounds = 10;

const UNKNOWN_JWT_SECRET    = '-- Unknown jwt secret --';
const DEFAULT_JWT_TTL       = 60 * 60 * 1000;
const DEFAULT_RENEW_JWT_TTL = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_LOCALE        = 'fr-FR';
// const DEFAULT_WELCOME_EMAIL_SUBJECT = 'Subscription';
// const DEFAULT_WELCOME_EMAIL = 'Welcome {{username}}!';
// const DEFAULT_ATTACHMENTS   = [];
//
// const DEFAULT_LOST_PASSWORD_EMAIL_SUBJECT = 'Password reset';
// const DEFAULT_LOST_PASSWORD_EMAIL =
// `<p>Your temporary password is <code>{{password}}</code></p>
// <p>This password is valid during 7 days.</p>
// `;


const RECOVERY_PASSWORD_TTL = 7 * 24 * 60 * 60 * 1000;

/*
Factorized funciton to send email, used by sign up and lost password functions
 */
// const sendEmail = async(options) => {
//
//   const { mailgun, sender, email, subject, html } = options;
//
//   if (!email) {
//     console.warn('AccountsModel.sendEmail(): Unable to send welcome email, email missing.');
//     return false;
//   }
//
//   if (!mailgun) {
//     console.warn('AccountsModel.sendEmail(): Unable to send welcome email, Mailgun configuraiton missing.');
//     return false;
//   }
//
//   const mailer = nodemailer.createTransport(mailgunTransport({
//     auth : {
//       'api_key' : mailgun.apiKey,
//       'domain'  : mailgun.domain
//     }
//   }));
//
//
//
//   await new Promise((resolve, reject) => {
//     mailer.sendMail({
//       from    : sender,
//       to      : email,
//       subject : subject,
//       html    : html
//     }, function (err, info) {
//       if (err) {
//         console.warn(`AccountsModel.sendEmail(): Unable to send welcome email, mailer error '${err}'`);
//       }
//       resolve();
//     });
//   });
//
//   return true;
// };



// const deleteAlsoEmailAuth = (mongooseModels) => (data, flow, meta) => {};
// const denyAllExceptSelfAndAdmin = (mongooseModels) => (data, flow, meta) => {};



/*
Tests if an email already exists in emailCredentials collection.
Stops execution of the flow if exists.
 */
const checkDuplicateEmailAuth = async (data, flow, meta) => {
  console.info('AccountsModel.checkDuplicateEmailAuth()');
  const { db } = meta.environment || {};

  const model = db.models['emailCredentials'];
  if (!model) {
    return flow.stop(404, 'emailCredentials collection not found in database');
  }

  const { method, data : {email} } = meta.request.body;

  if (method === 'email') {
    try {
      const { documents } = await db.readMany('emailCredentials', {email});

      if (documents.length) {
        return flow.stop(409, 'Existing email');
      }

      meta.accountsAPI = Object.assign(meta.accountsAPI || {}, {email});
    }
    catch (error) {
      return flow.stop(400, error.message);
    }
  }

  return flow.continue(data);
};

/*
Creates a new account
 */
const createNewAccount = async (data, flow, meta) => {
  console.info('AccountsModel.createNewAccount()');

  const { db } = meta.environment || {};

  let { locale, roles = [], resources = [] } = meta.request.body;

  if (!locale || !LocaleCode.validateLanguageCode(locale) || !LocaleCode.validateCountryCode(locale)) {
    const { accountsAPI = {} } = meta.environment || {};
    locale = accountsAPI.locale || DEFAULT_LOCALE;
  }

  try {
    const saved = await db.create('accounts', { locale, roles, resources });

    meta.accountsAPI = Object.assign(meta.accountsAPI || {}, {locale});

    return flow.continue({id : saved.id, locale, roles, resources});
  }
  catch (error) {
    return flow.stop(400, error.message);
  }
};

/*
Stores email credentials if the account was created with email and password
 */
const createNewEmailCredentials = async (data, flow, meta) => {
  console.info('AccountsModel.createNewEmailCredentials()');

  const { db } = meta.environment || {};

  const accountId = data.id;
  const { method } = meta.request.body;
  const { email, password } = meta.request.body.data;

  if (method === 'email') {
    const bcrypted = await bcrypt.hash(password, saltRounds);

    try {
      await db.create('emailCredentials', {accountId, email, password: bcrypted});
    }
    catch (error) {
      return flow.stop(400, error.message);
    }
  }

  return flow.continue({...data, email});
};

/*
Send welcome email through Mailgun
 */
const sendWelcomeEmail = async (data, flow, meta) => {
  console.info('AccountsModel.sendWelcomeEmail()');

  const { db, mailer = voidMailer } = meta.environment || {};

  const {email = false} =  data;

  const emailSent = mailer.sendWelcome(email, {data}, meta);
  // const { mailgun = false, accountsAPI = {} } = meta.environment || {};
  //
  // const locale    = accountsAPI.locale || DEFAULT_LOCALE;
  // const templates = accountsAPI.lostPasswordEmail || DEFAULT_LOST_PASSWORD_EMAIL;
  // const subjects  = accountsAPI.lostPasswordSubject || DEFAULT_LOST_PASSWORD_EMAIL_SUBJECT;
  // const sender    = accountsAPI.welcomeEmailSender || accountsAPI.sender || '';
  //
  // const language   = LocaleCode.getLanguageCode(locale);
  //
  // const templateHB = handlebars.compile(isPlainObject(templates) ? templates[language] : templates);
  // const subjectHB  = handlebars.compile(isPlainObject(subjects) ? subjects[language] : subjects);
  //
  // const hbContext = {username : email};
  //
  // const subject = subjectHB(hbContext);
  // const html    = templateHB(hbContext);
  //
  // const attachments = accountsAPI.attachments || DEFAULT_ATTACHMENTS;
  //
  // const emailSent = await sendEmail({
  //   mailgun,
  //   email,
  //   sender,
  //   subject,
  //   html,
  //   attachments
  // });

  if (!emailSent) {
    console.error('AccountsModel.sendWelcomeEmail(): unable to send welcome email. See error above.');
  }

  return flow.continue(data);
};



/* ------------------------------------------------------------------------
Login methods
 */

const errorIfNotLoggedIn = async (data, flow, meta) => {
  console.info('AccountsModel.errorIfNotLoggedIn()');

  const { db } = meta.environment || {};

  if (!data.accountId) {
    return flow.stop(401, 'Invalid credentials');
  }

  return flow.continue(data);
};

const loadAccountData = async (data, flow, meta) => {
  console.info('AccountsModel.loadAccountData()');

  const { db } = meta.environment || {};

  const model = db.models['accounts'];
  if (!model) {
    return flow.stop(404, 'accounts collection not found in database');
  }

  const { accountId } = data;

  try {
    const document = await db.readOne('accounts', accountId);

    if (document) {
      return flow.continue({...data, roles : document.roles || [], resources : document.resources || []});
    }

    return flow.stop(401, 'Invalid credentials');
  }
  catch (error) {
    return flow.stop(400, error.message);
  }
};

const createJWT = async (data, flow, meta) => {
  console.info('AccountsModel.createJWT()');

  const environment = meta.environment || {};

  const {
    jwtSecret,
    jwtTtl = DEFAULT_JWT_TTL
  } = environment;

  const {accountId, roles, resources} = data;

  const resourcesDictionary = resources.reduce(
    (dictionary, {key, value}) => {
      if(!dictionary[key]) {
        dictionary[key] = [];
      }

      if(!dictionary[key].includes(value)) {
        dictionary[key].push(value);
      }

      return dictionary;

    },
    {}
  );

  if (!jwtSecret) {
    console.error('AccountsModel.createJWT(): JWT secret not provided! Login is not allowed: potential security risk.');
    return flow.stop(500);
  }

  const token = jwt.sign({accountId, roles, resources : resourcesDictionary}, jwtSecret, {expiresIn: jwtTtl});

  console.info(`AccountsModel.createJWT(): Account ${accountId} logged in.`);

  return flow.continue({
    ...data,
    token
  });
};

const createRenewJWT = async (data, flow, meta) => {
  console.info('AccountsModel.createRenewJWT()');

  const environment = meta.environment || {};

  const {
    renewJwtSecret,
    renewJwtTtl = DEFAULT_RENEW_JWT_TTL,
    unlimitedLogin = true
  } = environment;

  const {accountId, roles} = data;

  if (!renewJwtSecret) {
    console.error('AccountsModel.createRenewJWT(): JWT secret not provided! Login is not allowed: potential security risk.');
    return flow.stop(500);
  }

  let renewToken = data.renewToken;

  if (unlimitedLogin || data.renewToken === undefined) {
    renewToken = jwt.sign({accountId, roles}, renewJwtSecret, {expiresIn: renewJwtTtl});
  }

  return flow.continue({
    ...data,
    renewToken
  });
};

const lostPassword = async (data, flow, meta) => {
  console.info('AccountsModel.lostPassword()');

  const { db, mailer = voidMailer } = meta.environment || {};

  const model = db.models['emailCredentials'];
  if (!model) {
    return flow.stop(404, 'emailCredentials collection not found in database');
  }

  const { email } = meta.request.body;

  try {
    const { documents } = await db.readMany('emailCredentials', {email});

    const document = documents.length ? documents[0] : null;

    if (document) {
      const newPassword = passwordGenerator.generate();
      const bcrypted    = await bcrypt.hash(newPassword, saltRounds);

      await db.patch('emailCredentials', document.id, {
        recoveryPassword: bcrypted,
        recoveryExpiresAt: new Date(Date.now() + RECOVERY_PASSWORD_TTL)
      });

      const emailSent = mailer.sendLostPassword(email, {data : {
        password : newPassword
      }}, meta);

      // const { mailgun = false, accountsAPI = {} } = meta.environment || {};
      //
      // const locale    = accountsAPI.locale || DEFAULT_LOCALE;
      // const templates = accountsAPI.lostPasswordEmail || DEFAULT_LOST_PASSWORD_EMAIL;
      // const subjects  = accountsAPI.lostPasswordSubject || DEFAULT_LOST_PASSWORD_EMAIL_SUBJECT;
      // const sender    = accountsAPI.welcomeEmailSender || accountsAPI.sender || '';
      //
      // const language   = LocaleCode.getLanguageCode(locale);
      //
      // const templateHB = handlebars.compile(isPlainObject(templates) ? templates[language] : templates);
      // const subjectHB  = handlebars.compile(isPlainObject(subjects) ? subjects[language] : subjects);
      //
      // const hbContext = {password : newPassword};
      //
      // const subject = subjectHB(hbContext);
      // const html    = templateHB(hbContext);
      // const attachments = accountsAPI.attachments || DEFAULT_ATTACHMENTS;
      //
      // const emailSent = await sendEmail({
      //   mailgun,
      //   email,
      //   sender,
      //   subject,
      //   html,
      //   attachments
      // });

      if (!emailSent) {
        console.error('AccountsModel.lostPassword(): unable to send password reset email. See error above.');
      }

      return flow.continue(data);
    }

    return flow.stop(401, 'Invalid credentials');
  }
  catch (error) {
    return flow.stop(400, error.message);
  }
};

const changePassword = async (data, flow, meta) => {
  console.info('AccountsModel.changePassword()');

  const { db } = meta.environment || {};

  const model = db.models['emailCredentials'];
  if (!model) {
    return flow.stop(404, 'emailCredentials collection not found in database');
  }

  const { accountId, email, password } = meta.request.body;

  try {
    const {documents} = await db.readMany('emailCredentials', {accountId});

    const document = documents.length ? documents[0] : null;

    if (document) {
      const bcrypted = await bcrypt.hash(password, saltRounds);

      await db.patch('emailCredentials', document.id, {password: bcrypted, recoveryPassword: ''});
      return flow.continue(data);
    }

    return flow.stop(401, 'Invalid credentials');
  }
  catch (error) {
    return flow.stop(400, error.message);
  }
};

const checkRenewToken = async (data, flow, meta) => {
  console.info('AccountsModel.checkRenewToken()');

  const { db } = meta.environment || {};

  const model = db.models['accounts'];
  if (!model) {
    return flow.stop(500, 'accounts collection not found in database');
  }

  const { renewToken } = meta.request.body;
  const renewSecret = meta.environment.renewJwtSecret;

  if (!renewSecret) {
    console.error('AccountsModel.checkRenewToken(): JWT secret not provided! Token renewal is not allowed: potential security risk.');
    return flow.stop(500);
  }

  let payload = null;

  try {
    payload = jwt.verify(renewToken, renewSecret);
  }
  catch (error) {
    console.error(error);
    return flow.stop(401, "Invalid renewal token");
  }

  const {accountId} = payload;

  try {
    const document = await db.readOne('accounts', accountId);

    if (document && document.active) {
      return flow.continue({accountId, renewToken});
    }

    return flow.stop(404, 'Invalid account');
  }
  catch (error) {
    return flow.stop(400, error.message);
  }
};

const getSelf = async (data, flow, meta) => {
  console.info('AccountsModel.getSelf()');

  const { db } = meta.environment || {};
  const { accountId } = meta.auth || {};

  try {
    const document = await db.readOne('accounts', accountId);

    if (document && document.active) {
      return flow.continue(document);
    }

    return flow.stop(404, 'Invalid account');
  }
  catch (error) {
    console.error(error);
    return flow.stop(400, error.message);
  }
}


module.exports = {
  checkDuplicateEmailAuth,
  createNewAccount,
  createNewEmailCredentials,
  sendWelcomeEmail,
  errorIfNotLoggedIn,
  loadAccountData,
  createJWT,
  createRenewJWT,
  lostPassword,
  changePassword,
  checkRenewToken,
  getSelf
};
