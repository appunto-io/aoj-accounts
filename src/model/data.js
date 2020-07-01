const accountsDataModel = {
  'accounts' : {
    'schema' : {
      'roles'  : {'type' : 'Mixed', 'default' : []},
      'locale' : {'type' : 'String', 'default' : 'fr_FR'},
      'active' : {'type' : 'Boolean', 'default' : true}
    }
  },
  'roles' : {
    'schema' : {
      'name' : {'type' : 'String', 'index' : true, 'unique' : true, 'required' : true}
    }
  }
};

module.exports = { accountsDataModel };
