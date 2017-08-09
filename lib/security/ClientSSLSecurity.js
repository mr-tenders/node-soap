'use strict';

const fs = require('fs');
const https = require('https');

class ClientSSLSecurity {
  /**
   * activates SSL for an already existing client
   *
   * @module ClientSSLSecurity
   * @param {Buffer|String}   key
   * @param {Buffer|String}   cert
   * @param {Buffer|String|Array}   [ca]
   * @param {Object}          [defaults]
   * @constructor
   */
  constructor(key, cert, ca, defaults = {}) {
    if (key) {
      if(Buffer.isBuffer(key)) {
        this.key = key;
      } else if (typeof key === 'string') {
        this.key = fs.readFileSync(key);
      } else {
        throw new Error('key should be a buffer or a string!');
      }
    }

    if (cert) {
      if(Buffer.isBuffer(cert)) {
        this.cert = cert;
      } else if (typeof cert === 'string') {
        this.cert = fs.readFileSync(cert);
      } else {
        throw new Error('cert should be a buffer or a string!');
      }
    }

    if (ca) {
      if(Buffer.isBuffer(ca) || Array.isArray(ca)) {
        this.ca = ca;
      } else if (typeof ca === 'string') {
        this.ca = fs.readFileSync(ca);
      } else {
        defaults = ca;
        this.ca = null;
      }
    }

    this.defaults = {};
    Object.assign(this.defaults, defaults);
  }

  addOptions(options) {
    const {
      key
    , cert
    , ca
    , defaults } = this;

    Object.assign(options, {
      key
    , cert
    , ca
    }, defaults);

    options.agent = new https.Agent(options);
  }

  toXML(headers) {
    return '';
  }
}

module.exports = ClientSSLSecurity;
