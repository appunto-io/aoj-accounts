const {
  ApiModel,
  DataModel
} = require('@appunto/api-on-json');

const {
  emailDataModel,
  emailLoginApiModel
} = require('./loginWith/loginWithEmail.js');

const {
  facebookDataModel,
  facebookLoginApiModel
} = require('./loginWith/loginWithFacebook.js');

const {
  googleDataModel,
  googleLoginApiModel
} = require('./loginWith/loginWithGoogle.js');

const {
  linkedinDataModel,
  linkedinLoginApiModel
} = require('./loginWith/loginWithLinkedin.js');

const {
  passwordlessDataModel,
  passwordlessLoginApiModel
} = require('./loginWith/loginWithPasswordless.js');

const { accountsDataModel } = require('./model/data');
const { accountsApiModel }  = require('./model/api');


function createAccountsApiModel(options = {}) {
  const {
    email        = true,
    facebook     = false,
    google       = false,
    linkedin     = false,
    passwordless = false
  } = options;

  const dataModel = new DataModel(accountsDataModel);
  const apiModel  = new ApiModel(accountsApiModel);

  if (email) {
    dataModel.addModel(emailDataModel);
    apiModel.addModel(emailLoginApiModel);
  }

  if (facebook) {
    dataModel.addModel(facebookDataModel);
    apiModel.addModel(facebookLoginApiModel);
  }

  if (google) {
    dataModel.addModel(googleDataModel);
    apiModel.addModel(googleLoginApiModel);
  }

  if (linkedin) {
    dataModel.addModel(linkedinDataModel);
    apiModel.addModel(linkedinLoginApiModel);
  }

  if (passwordless) {
    dataModel.addModel(passwordlessDataModel);
    apiModel.addModel(passwordlessLoginApiModel);
  }

  return {dataModel, apiModel};
}

module.exports = {createAccountsApiModel};
