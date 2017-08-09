'use strict';

let fs = require('fs'),
    join = require('path').join;

describe('ClientSSLSecurity', function() {
  let ClientSSLSecurity = require('../../').ClientSSLSecurity;
  let cert = __filename;
  let key = __filename;

  it('is a function', function() {
    ClientSSLSecurity.should.be.type('function');
  });

  describe('defaultOption param', function() {
    it('is accepted as the third param', function() {
      new ClientSSLSecurity(null, null, {});
    });

    it('is used in addOptions', function() {
      let options = {};
      let defaultOptions = { foo: 5 };
      let instance = new ClientSSLSecurity(null, null, defaultOptions);
      instance.addOptions(options);
      options.should.have.property("foo", 5);
    });
  });


  it('should accept extraneous data before cert encapsulation boundaries per rfc 7468', function () {
    let certBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-cert-with-extra-data.pem'));

    let instanceCert = new ClientSSLSecurity(null, certBuffer);
  });

  it('should accept a Buffer as argument for the key or cert', function () {
    let certBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-cert.pem')),
      keyBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-key.pem')),
      instance;

    instance = new ClientSSLSecurity(keyBuffer, certBuffer, certBuffer);
    instance.should.have.property("ca", certBuffer);
    instance.should.have.property("cert", certBuffer);
    instance.should.have.property("key", keyBuffer);
  });

  it('should accept a Array as argument for the ca', function () {
    let caList = [];
    let instance = new ClientSSLSecurity(null, null, caList);
    instance.should.have.property("ca", caList);
  });
});
