const { sanitizeAllow } = require('@appunto/api-on-json');

const {
  checkDuplicateEmailAuth,
  createNewAccount,
  createNewEmailCredentials,
  sendWelcomeEmail,
  errorIfNotLoggedIn,
  loadRoles,
  createJWT,
  createRenewJWT,
  checkRenewToken
} = require('./library.js');

const accountsApiModel = {
  '/accounts' : {
    '/new' : {
      auth : {
        POST : { requiresAuth : false }
      },
      handlers : {
        POST : [createNewAccount, createNewEmailCredentials, sendWelcomeEmail]
      },
      filters : {
        POST : [checkDuplicateEmailAuth]
      }
    }
  },

  '/roles' : {
    auth : {
      requiresRoles : ['admin']
    }
  },

  '/logins' : {
    auth : {
      POST : { requiresAuth : false }
    },
    handlers : {
      POST : [
        errorIfNotLoggedIn,
        loadRoles,
        createJWT,
        createRenewJWT,
        sanitizeAllow('token', 'renewToken', 'accountId')
      ]
    },
    filters : {
      POST : []
    },
    '/renew' : {
      auth : {
        POST : { requiresAuth : false }
      },
      handlers : {
        POST : [
          checkRenewToken,
          loadRoles,
          createJWT,
          createRenewJWT,
          sanitizeAllow('token', 'renewToken', 'accountId')
        ]
      }
    }
  }
};

module.exports = {accountsApiModel};