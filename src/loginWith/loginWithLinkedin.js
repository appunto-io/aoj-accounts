const fetch = require('node-fetch');
const { URLSearchParams } = require('url');

const {
  changePassword,
  lostPassword
} = require('../model/library.js');

const loginWithlinkedin = async (data, flow, meta) => {
  console.info('AccountsModel.loginWithLinkedIn()');

  const { db } = meta.environment || {};
  const { method, data: { lkClientId, lkClientSecret, lkCode } } = meta.request.body;

  if (method === 'linkedin') {
    try {
      const form = {
        code: lkCode,
        client_id: lkClientId,
        client_secret: lkClientSecret,
        redirect_uri: 'http://localhost:8080/',
        grant_type: 'authorization_code'
      };

      const params = new URLSearchParams();

      for (let elem in form) {
        params.append(elem, form[elem]);
      }

      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          body: params,
      });

      const {access_token} = await response.json();

      const userInfoResponse = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });

      const getUserEmail = await fetch('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });

      const {id} = await userInfoResponse.json();
      const {elements} = await getUserEmail.json();

      const email = elements[0]['handle~']['emailAddress'];

      const { documents } = await db.readMany('linkedinCredentials', {lkUserId: id});

      const document = documents.length ? documents[0] : null;

      if (document) {
        const verifyAccount = await db.readOne('accounts', document.accountId);

        if (verifyAccount && verifyAccount.active) {
          return flow.continue({ accountId : document.accountId });
        }
        return flow.stop(404, 'The account id given match no account in the data base.')
      }

      const account = await db.create('accounts', {});

      await db.create('linkedinCredentials', {
        accountId: account.id,
        lkUserId: id,
        lkToken: access_token,
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

const deleteLinkedinCredentials = async(data, flow, meta) => {
  console.info('AccountsModel.deleteLinkedinCredentials()');

  const { db } = meta.environment || {};
  const id     = meta.request.params['id'];

  const { documents } = await db.readMany('linkedinCredentials', {accountId: id});

  const document = documents.length ? documents[0] : null;

  if (document) {
    const removed = await db.remove('linkedinCredentials', document.id);
    console.info(`AccountsModel.deleteLinkedinCredentials(): Account ${document.id} was removed.`);
    return flow.continue({...data, removed});
  }

  return flow.continue(data);
};

const linkedinLoginApiModel = {
  "/accounts": {
    "/:id" : {
      handlers : {
        'DELETE' : [deleteLinkedinCredentials]
      }
    }
  },
  '/logins' : {
    'filters' : {
      'POST' : [
        loginWithlinkedin
      ]
    }
  }
}

const linkedinDataModel = {
  'linkedinCredentials' : {
    schema : {
      'accountId' : {type : 'Id', required : true},
      'lkUserId'  : {type : 'String', 'index' : true, 'unique' : true, 'required' : true},
      'lkToken'   : {type : 'String'},
      'email'     : {type : 'String'}
    }
  }
}

module.exports = {
  linkedinLoginApiModel,
  linkedinDataModel
}
