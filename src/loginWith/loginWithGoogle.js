const fetch = require('node-fetch');

const {
  changePassword,
  lostPassword
} = require('../model/library.js');

const loginWithGoogle = async (data, flow, meta) => {
  console.info('AccountsModel.loginWithGoogle()');

  const { db } = meta.environment || {};
  const { method, data: { goCode, goClientId, goClientSecret } } = meta.request.body;

  if (method === 'google') {
    try {
      var postDataUrl = 'https://www.googleapis.com/oauth2/v4/token?' +
          'code=' + goCode +
          '&client_id=' + goClientId +
          '&client_secret=' + goClientSecret +
          '&redirect_uri=' + 'http://localhost:8080/' +
          '&grant_type=authorization_code';

      const response = await fetch(postDataUrl, {method: 'post'});
      const {accessToken} = await response.json();


      const getUserInfoUrl     = `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${accessToken}`
      const userInfoResponse   = await fetch(getUserInfoUrl);
      const {id, email, error} = await userInfoResponse.json();

      if (error) {
        console.error(error.message);
        return flow.stop(401, error.message);
      }

      const { documents } = await db.readMany('googleCredentials', {goUserId: id});

      const document = documents.length ? documents[0] : null;

      if (document) {
        const verifyAccount = await db.readOne('accounts', document.accountId);

        if (verifyAccount && verifyAccount.active) {
          return flow.continue({ accountId : document.accountId });
        }
        return flow.stop(404, 'The account id given match no account in the data base.')
      }

      const account = await db.create('accounts', {});

      await db.create('googleCredentials', {
        accountId: account.id,
        goUserId: id,
        goToken: accessToken,
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

const deleteGoogleCredentials = async(data, flow, meta) => {
  console.info('AccountsModel.deleteGoogleCredentials()');

  const { db } = meta.environment || {};
  const id     = meta.request.params['id'];

  const { documents } = await db.readMany('googleCredentials', {accountId: id});

  const document = documents.length ? documents[0] : null;

  if (document) {
    const removed = await db.remove('googleCredentials', document.id);
    console.info(`AccountsModel.deleteGoogleCredentials(): Account ${document.id} was removed.`);
    return flow.continue({...data, removed});
  }

  return flow.continue(data);
};

const googleLoginApiModel = {
  "/accounts": {
    "/:id" : {
      handlers : {
        'DELETE' : [deleteGoogleCredentials]
      }
    }
  },
  '/logins' : {
    'filters' : {
      'POST' : [
        loginWithGoogle
      ]
    }
  }
}

const googleDataModel = {
  'googleCredentials' : {
    schema : {
      'accountId' : {type : 'Id', required : true},
      'goUserId'  : {type : 'String', 'index' : true, 'unique' : true, 'required' : true},
      'goToken'   : {type : 'String'},
      'email'     : {type : 'String'}
    }
  }
}

module.exports = {
  googleLoginApiModel,
  googleDataModel
}
