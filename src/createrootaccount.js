const invariant = require('invariant');
const bcrypt    = require('bcrypt');

const saltRounds = 10;

const createRootAccount = async (db, email = '', password = '', options = {}) => {
  console.warn('createRootAccount(): creating root account');

  invariant(
    db,
    'createRootAccount(): db not defined. ' +
    'You should call createRootAccount() after calling createAccountsLibrary();'
  );

  /*
    Sanitize parameters
   */
  email    = email.trim();
  password = password.trim();
  const { rootRole = 'root' } = options;

  if (!email || !password) {
    console.error('createRootAccount(): root and email password are not valid, skipping creation.');
    return null;
  }

  try {
    const { documents } = await db.readMany('emailCredentials', {email});

    if (documents.length) {
      console.info('createRootAccount(): root email is already in use, skipping creation.');
      return null;
    }

    /*
      Create root role
     */
    try {
      await db.create('roles', {name : rootRole});
    }
    catch (error) {
      console.warn('createRootAccount(): unable to create root role, maybe a root user already exists.');
    }

    /*
      Create account
     */
    const bcrypted = await bcrypt.hash(password, saltRounds);
    const account = await db.create('accounts', {roles : [rootRole]});

    await db.create('emailCredentials', {
      accountId : account.id,
      email     : email,
      password  : bcrypted
    });

    return account.id;
  }
  catch (error) {
    console.error('Error in createRootAccount(): %s', error.message);
    return null;
  }
};

module.exports = { createRootAccount };
