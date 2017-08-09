'use strict';

describe('BasicAuthSecurity', function() {
  let BasicAuthSecurity = require('../../').BasicAuthSecurity;
  let username = "admin";
  let password = "password1234";

  it('is a function', function() {
    BasicAuthSecurity.should.be.type('function');
  });

  describe('defaultOption param', function() {
    it('is accepted as the third param', function() {
      new BasicAuthSecurity(username, password, {});
    });

    it('is used in addOptions', function() {
      let options = {};
      let defaultOptions = { foo: 3 };
      let instance = new BasicAuthSecurity(username, password, defaultOptions);
      instance.addOptions(options);
      options.should.have.property("foo", 3);
    });
  });
});
