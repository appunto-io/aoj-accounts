require("dotenv").config({path: __dirname + '/../dev/.env'});

const mongoose              = require('mongoose');
const jwt                   = require('jsonwebtoken');
const chai                  = require('chai');
const chaiHTTP              = require('chai-http');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Mongo }             = require('@appunto/api-on-json');

const {
  createAccountsApiModel,
  createRootAccount } = require('./index.js');


const expect = chai.expect;
chai.use(chaiHTTP);

async function get(collection, token) {
  return chai.request('http://localhost:3000')
    .get(`/${collection}`)
    .set('Authorization', token);
}

async function post(collection, data, token) {
  return chai.request('http://localhost:3000')
    .post(`/${collection}`)
    .set('Authorization', token)
    .send(data);
}

async function erase(collection, id, token) {
  return chai.request('http://localhost:3000')
    .delete(`/${collection}/` + id)
    .set('Authorization', token);
}


/**********************************************
  Testsuite
*/

describe('account-model test suite', async function() {
    let db;
    let mongoServer;
    let serverOptions;

    before((done) => {
      mongoServer = new MongoMemoryServer();
      mongoServer
      .getConnectionString()
      .then((mongoUri) => {
        db = new Mongo(mongoUri);
        return db.connect();
      })
      .then(async() => {
        const {dataModel, apiModel} = createAccountsApiModel({passwordless:true});

        await db.connect();
        await db.init(dataModel);

        serverOptions = {
          db        : db,
          jwtTtl     : 5000,
          randomPattern : 'A0',
          jwtSecret : '--$$mysecret$$--',
          renewJwtSecret : '--renew--',
          mailgun : {
            apiKey : process.env.API_KEY,
            domain : process.env.DOMAIN
          },
          accountsAPI : {
            welcomeEmailSender : 'contact@appunto.io',
            sender : 'contact@appunto.io'
          }
        };

        await createRootAccount('root@root.com', 'pass', db).then(
          rootAccountId => {
            if (rootAccountId) {
              console.log(`Root account ${rootAccountId} created`);
            }
            else {
              console.warn('Root account not created');
            }
          },
          err => console.error(err)
        );

        this.server  = apiModel.toServer(serverOptions);
        await this.server.listen(3000);
        done()});
    });

    after(async () => {
      await this.server.close();
      await mongoose.disconnect();
      await mongoServer.stop();
    });

    describe('generic account-model test suite', async function() {
        it('Wrong credentials', async function() {
          const response = await post('logins', {
            method: "email",
            data: {
              email:'wrong@email.com',
              password: 'wrongPassToo'
            }
          }, '');

          expect(response.body).to.be.empty;
          expect(response.status).to.be.equal(401);
        });

        it('Valid credentials', async function() {
          const response = await post('logins', {
            method: "email",
            data: {
              email:'root@root.com',
              password: 'pass'
            }
          }, '');

          expect(response.status).to.be.equal(200);

          const {token, accountId, renewToken} = response.body || {};

          expect(token).to.be.a('string');
          expect(renewToken).to.be.a('string');
          expect(accountId).to.be.a('string');

          const decoded = jwt.verify(token, serverOptions.jwtSecret);
          const decodedRenew = jwt.verify(renewToken, serverOptions.renewJwtSecret);

          expect(decoded.accountId).to.be.equal(accountId);
          expect(decodedRenew.accountId).to.be.equal(accountId);
        });

        it('inactive account', async function() {
          const response = await post('logins', {
            method: "email",
            data: {
              email:'root@root.com',
              password: 'pass'
            }
          }, '');

          const {accountId} = response.body;

          const patched = await db.patch('accounts', accountId, {active: false});

          const response2 = await post('logins', {
            method: "email",
            data: {
              email:'root@root.com',
              password: 'pass'
            }
          }, '');

          expect(response2.status).to.be.equal(404);

          await db.patch('accounts', accountId, {active: true});
        });


        it('create an account and log in', async function() {
          const response = await post('accounts/new', {
            method: 'email',
            data: {
              email:'hello@hi.com',
              password: 'pass'
            }
          }, '');

          expect(response.status).to.be.equal(200);
          expect(response.body.email).to.be.equal('hello@hi.com');
          expect(response.body.id).to.be.a('string');
        });

        it('fails to create an account with an existing email', async function() {
          const response = await post('accounts/new', {
            method: 'email',
            data: {
              email:'root@root.com',
              password: 'newPass'
            }

          }, '');

          expect(response.status).to.be.equal(409);
        });

        it('renew token', async function() {
          const response = await post('logins', {
            method: "email",
            data: {
              email:'root@root.com',
              password: 'pass'
            }
          }, '');

          const {documents} = await db.readMany('emailCredentials', {email:'root@root.com'});

          const renewToken = response.body.renewToken;

          const response2 = await post('logins/renew', {renewToken}, '');

          expect(response2.status).to.be.equal(200);
        });

        it('Test passwordless login', async function() {
          const email = 'email@example.com';
          await post('logins', {
            method: "passwordless",
            data: {
              email
            }
          }, '');

          const {documents} = await db.readMany('passwordlessCredentials', {email});

          const {codes} = documents[0];

          const {code} = codes[0];

          const response = await post('logins', {
            method: "passwordless",
            data: {
              email,
              code
            }
          }, '');

          expect(response.status).to.be.equal(200);
          expect(response.body.token).to.be.a('string');
          expect(response.body.accountId).to.be.a('string');
        });

        it('Test passwordless login too late for the code', async function() {
          const email = 'email@example.com';
          await post('logins', {
            method: "passwordless",
            data: {
              email
            }
          }, '');

          const {documents} = await db.readMany('passwordlessCredentials', {email});
          const {codes, id} = documents[0];
          codes[0].expiresAt = Date.now();
          const {code} = codes;


          await db.patch('passwordlessCredentials', id, {codes});

          const response = await post('logins', {
            method: "passwordless",
            data: {
              email,
              code
            }
          }, '');

          expect(response.status).to.be.equal(401);
          expect(response.body).to.be.empty;
        });

        it('it test the delete chain', async function() {
          const email = 'email@example.com';
          await post('logins', {
            method: "passwordless",
            data: {
              email
            }
          }, '');

          const {documents} = await db.readMany('passwordlessCredentials', {email});
          const {codes} = documents[0];
          const {code} = codes[0];

          const response = await post('logins', {
            method: "passwordless",
            data: {
              email,
              code
            }
          }, '');

          expect(response.status).to.be.equal(200);

          const {token, accountId, renewToken} = response.body || {};

          expect(token).to.be.a('string');
          expect(accountId).to.be.a('string');

          const {body} = await erase('accounts', accountId, `Bearer ${token}`);

          const {documents: updateDocuments} = await db.readMany('passwordlessCredentials', {email});

          expect(updateDocuments).to.be.an('array');
          expect(updateDocuments).to.be.empty;
          expect(body.removed.accountId).to.be.equal(accountId);
        });

        it('too late', async function() {
          const response = await post('logins', {
            method: "email",
            data: {
              email:'root@root.com',
              password: 'newPass'
            }
          }, '');

          const token = response.body.token;
          const accountId = response.body.accountId;

          const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

          await wait(7 * 1000);

          const response2 = await post('email-credentials/change', {
            accountId,
            email: 'root@root.com',
            password: 'newPass'
          }, 'Bearer ' + token);

          expect(response2.status).to.be.equal(401);
        });

        it('change password', async function() {
          const response = await post('logins', {
            method: "email",
            data: {
              email:'root@root.com',
              password: 'pass'
            }
          }, '');

          const token = response.body.token;
          const accountId = response.body.accountId;

          const response2 = await post('email-credentials/change', {
            accountId,
            email: 'root@root.com',
            password: 'newPass'
          }, 'Bearer ' + token);

          expect(response2.status).to.be.equal(200);
        });

        it('change password with invalid credentials', async function() {
          const response = await post('logins', {
            method: "email",
            data: {
              email:'root@root.com',
              password: 'newPass'
            }
          }, '');

          const token = response.body.token;
          const accountId = 'bad accountId';

          const response2 = await post('email-credentials/change', {
            accountId,
            email: 'root@root.com',
            password: 'newPass'
          }, 'Bearer ' + token);

          expect(response2.status).to.be.equal(401);
        });

        it('lost password', async function() {
          const response = await post('email-credentials/lost', {
            email: 'root@root.com'
          }, '');

          expect(response.status).to.be.equal(200);
        });

        it('lost password with invalid credentials', async function() {
          const response = await post('email-credentials/lost', {
            email: 'badMail@root.com',
          }, '');

          expect(response.status).to.be.equal(401);
        });
    });
});
