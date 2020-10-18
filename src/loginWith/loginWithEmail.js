const bcrypt = require('bcrypt');

const {
  changePassword,
  lostPassword
} = require('../model/library.js');

const loginWithEmail = async (data, flow, meta) => {
  console.info('AccountsModel.loginWithEmail()');

  const { db } = meta.environment || {};
  const { method, data: { email, password } } = meta.request.body;

  if (method === 'email') {
    try {
      const { documents } = await db.readMany('emailCredentials', {email});

      const document = documents.length ? documents[0] : null;

      if (document) {
        const verifyAccount = await db.readOne('accounts', document.accountId);
        const { id, ...accountDocument } = verifyAccount;

        if (verifyAccount && verifyAccount.active) {
          const logged = await bcrypt.compare(password, document.password);

          if (logged) {
            return flow.continue({ accountId : document.accountId, ...accountDocument });
          }

          if (document.recoveryPassword) {
            const recoveryLoggged = await bcrypt.compare(password, document.recoveryPassword);

            if (recoveryLoggged && document.recoveryExpiresAt > Date.now()) {
              return flow.continue({
                accountId : document.accountId,
                ...accountDocument
              });
            }
          }
        }
        else {
          return flow.stop(404, 'The account id given match no account in the data base.');
        }
      }

      return flow.stop(401, 'Invalid credentials');
    }
    catch (error) {
      return flow.stop(400, error.message);
    }
  }
  return flow.continue(data);
};

const deleteEmailCredentials = async(data, flow, meta) => {
  console.info('AccountsModel.deleteEmailCredentials()');

  const { db } = meta.environment || {};
  const id     = meta.request.params['id'];

  const { documents } = await db.readMany('emailCredentials', {accountId: id});

  const document = documents.length ? documents[0] : null;

  if (document) {
    await db.remove('emailCredentials', document.id);
    console.info(`AccountsModel.deleteEmailCredentials(): Account ${document.id} was removed.`)
  }

  return flow.continue(data);
};

const emailLoginApiModel = {
  "/accounts": {
    "/:id" : {
      handlers : {
        'DELETE' : [deleteEmailCredentials]
      }
    }
  },
  '/logins' : {
    'filters' : {
      'POST' : [
        loginWithEmail
      ]
    }
  },
  '/email-credentials' : {
    '/change' : {
      'auth' : {
        'POST' : {'requiresAuth' : true, 'requiresRoles' : false}
      },
      'handlers' : {
        'POST' : [changePassword]
      }
    },
    '/lost' : {
      'auth' : {
        'POST' : {'requiresAuth' : false}
      },
      'handlers' : {
        'POST' : [lostPassword]
      }
    }
  }
}

const emailDataModel = {
  'emailCredentials' : {
    'schema' : {
      'accountId'         : {'type' : 'Id', 'required' : true},
      'email'             : {'type' : 'String', 'index' : true, 'unique' : true, 'required' : true},
      'password'          : {'type' : 'String', 'required' : true},
      'recoveryPassword'  : 'String',
      'recoveryExpiresAt' : 'Date'
    }
  }
}

module.exports = {
  emailLoginApiModel,
  emailDataModel
}
