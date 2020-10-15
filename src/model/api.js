const { sanitizeAllow } = require('@appunto/api-on-json');

const {
  checkDuplicateEmailAuth,
  createNewAccount,
  createNewEmailCredentials,
  sendWelcomeEmail,
  errorIfNotLoggedIn,
  loadAccountData,
  createJWT,
  createRenewJWT,
  checkRenewToken
} = require('./library.js');

const accountsApiModel = {
  '/accounts' : {
    auth : {
      read  : { requiresAuth : true, requiresRoles : ['root'] },
      write : false
    },
    '/:id' : {
      auth : {
        read  : { requiresAuth : true, requiresRoles : ['root'] },
        write : { requiresAuth : true, requiresRoles : ['root'] }
      }
    },
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
      requiresRoles : ['root']
    }
  },

  '/logins' : {
    auth : {
      POST : { requiresAuth : false }
    },
    handlers : {
      POST : [
        errorIfNotLoggedIn,
        loadAccountData,
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
          loadAccountData,
          createJWT,
          createRenewJWT,
          sanitizeAllow('token', 'renewToken', 'accountId')
        ]
      }
    }
  }
};

module.exports = {accountsApiModel};
