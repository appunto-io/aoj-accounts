const fetch = require('node-fetch');

const {
  changePassword,
  lostPassword
} = require('../model/library.js');


const loginWithFacebook = async (data, flow, meta) => {
  console.info('AccountsModel.loginWithFacebook()');

  const { db } = meta.environment || {};
  const { method, data: { fbToken, fbUserId } } = meta.request.body;

  if (method === 'facebook') {
    try {
      const url = `https://graph.facebook.com/me?access_token=${fbToken}&fields=id,email`;
      const response = await fetch(url);
      const {id, email, error} = await response.json();

      if (id !== fbUserId || error) {
        console.error(error.message);
        return flow.stop(401, error.message);
      }

      const { documents } = await db.readMany('facebookCredentials', {fbUserId});

      const document = documents.length ? documents[0] : null;

      // User already signed up with this Facebook ID
      if (document) {
        const verifyAccount = await db.readOne('accounts', document.accountId);

        if (verifyAccount && verifyAccount.active) {
          return flow.continue({ accountId : document.accountId });
        }

        return flow.stop(404, 'The account id given match no account in the data base.')
      }

      const account = await db.create('accounts', {});

      await db.create('facebookCredentials', {
        accountId: account.id,
        fbUserId,
        fbToken,
        email
      });

      return flow.continue({ accountId : account.id });
    }
    catch (error) {
      return flow.stop(400, error.message);
    }
  }

  return flow.continue(data);
};

const deleteFacebookCredentials = async(data, flow, meta) => {
  console.info('AccountsModel.deleteFacebookCredentials()');

  const { db } = meta.environment || {};
  const id     = meta.request.params['id'];

  const { documents } = await db.readMany('facebookCredentials', {accountId: id});

  const document = documents.length ? documents[0] : null;

  if (document) {
    const removed = await db.remove('facebookCredentials', document.id);
    console.info(`AccountsModel.deleteFacebookCredentials(): Account ${document.id} was removed.`);

    return flow.continue({...data, removed});
  }

  return flow.continue(data);
};

const facebookLoginApiModel = {
  "/accounts": {
    "/:id" : {
      handlers : {
        'DELETE' : [deleteFacebookCredentials]
      }
    }
  },
  '/logins' : {
    'filters' : {
      'POST' : [
        loginWithFacebook
      ]
    }
  }
}

const facebookDataModel = {
  'facebookCredentials' : {
    schema : {
      'accountId' : {type : 'Id', required : true},
      'fbUserId'  : {type : 'String', 'index' : true, 'unique' : true, 'required' : true},
      'fbToken'   : {type : 'String'},
      'email'     : {type : 'String'}
    }
  }
}

module.exports = {
  facebookLoginApiModel,
  facebookDataModel
}
