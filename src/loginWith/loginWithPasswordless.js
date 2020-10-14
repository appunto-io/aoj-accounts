const fetch = require('node-fetch');
const randomize = require('randomatic');

const {
  changePassword,
  lostPassword,
  sendEmail
} = require('../model/library.js');

const DEFAULT_CODE_TTL = 10 * 60 * 1000;
const DEFAULT_PATTERN = '0';
const DEFAULT_RANDOM_LENGHT = 6;

const loginWithPasswordless = async (data, flow, meta) => {
  console.info('AccountsModel.loginWithPasswordless()');

  const { db,
          codeTtl = DEFAULT_CODE_TTL,
          randomPattern = DEFAULT_PATTERN,
          randomLength = DEFAULT_RANDOM_LENGHT } = meta.environment || {};

  const { method, data: { email, code } } = meta.request.body;

  if (method === 'passwordless') {
    try {
      const { documents: codesDocuments } = await db.readMany('passwordlessCredentials', {email});

      const userCodes = codesDocuments.length ? codesDocuments[0] : {};

      var codes = userCodes.codes || [];

      codes = codes.filter(({code, expiresAt}) => expiresAt > Date.now());
      var filteredCodes = codes.map(({code}) => code);

      if (code) {
        if (!filteredCodes.includes(code)) {
          console.error('Your code is not valid anymore. Try getting another one.');
          return flow.stop(401, 'Your code is not valid anymore. Try getting another one.');
        }

        const document = await db.readOne('passwordlessCredentials', userCodes.id);

        if (document.accountId != false) {
          const verifyAccount = await db.readOne('accounts', document.accountId);

          if (verifyAccount) {
            return flow.continue({ accountId : document.accountId });
          }
          return flow.stop(404, 'The account id given match no account in the data base.')
        }

        const account = await db.create('accounts', {});

        await db.patch('passwordlessCredentials', userCodes.id, {
          accountId: account.id,
          email,
          codes: []
        });

        return flow.continue({ accountId : account.id });
      }


      const randomCode = randomize(randomPattern, randomLength);

      codes.push({code: randomCode, expiresAt: new Date(Date.now() + codeTtl)});

      if (userCodes.id) {
        await db.patch('passwordlessCredentials', userCodes.id, {codes});
      } else {
        await db.create('passwordlessCredentials', {accountId: false, email, codes});
      }

      const {
        mailgun = false,
        accountsAPI = {} } = meta.environment || {};

      const sender = accountsAPI.welcomeEmailSender || accountsAPI.sender || '';

      const emailSent = await sendEmail({
        mailgun,
        email,
        sender,
        subject: 'Your authentication code',
        html: `<b>Code: ${randomCode}</b>`
      });

      if (!emailSent) {
        console.error('AccountsModel.loginWithPasswordless(): unable to send code authentication email. See error above.');
      }
    }
    catch (error) {
      console.error(error.message);
      return flow.stop(400, error.message);
    }
  }
  return flow.continue(data);
};

const deletePasswordlessCredentials = async(data, flow, meta) => {
  console.info('AccountsModel.deletePasswordlessCredentials()');

  const { db } = meta.environment || {};
  const id     = meta.request.params['id'];

  const { documents } = await db.readMany('passwordlessCredentials', {accountId: id});

  const document = documents.length ? documents[0] : null;

  if (document) {
    const removed = await db.remove('passwordlessCredentials', document.id);
    console.info(`AccountsModel.deletePasswordlessCredentials(): Account ${document.id} was removed.`);
    return flow.continue({...data, removed});
  }

  return flow.continue(data);
};

const passwordlessLoginApiModel = {
  "/accounts": {
    "/:id" : {
      handlers : {
        'DELETE' : [deletePasswordlessCredentials]
      }
    }
  },
  '/logins' : {
    'filters' : {
      'POST' : [
        loginWithPasswordless
      ]
    }
  }
}

const passwordlessDataModel = {
  'passwordlessCredentials' : {
    schema : {
      'accountId' : {type : 'Id', required : true},
      'email'  : {type : 'String', 'index' : true, 'unique' : true, 'required' : true},
      'codes'  : {type : 'Mixed', 'default' : []}
    }
  }
}

module.exports = {
  passwordlessLoginApiModel,
  passwordlessDataModel
}
