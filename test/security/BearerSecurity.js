'use strict';

describe('BearerSecurity', function() {
  let BearerSecurity = require('../../').BearerSecurity;
  let token = "token";

  it('is a function', function() {
    BearerSecurity.should.be.type('function');
  });

  describe('defaultOption param', function() {
    it('is accepted as the second param', function() {
      new BearerSecurity(token, {});
    });

    it('is used in addOptions', function() {
      let options = {};
      let defaultOptions = { foo: 2 };
      let instance = new BearerSecurity(token, defaultOptions);
      instance.addOptions(options);
      options.should.have.property("foo", 2);
    });
  });
});
