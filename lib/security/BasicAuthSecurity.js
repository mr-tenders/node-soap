"use strict";

class BasicAuthSecurity {
  constructor(username, password, defaults = {}) {
    this._username = username;
    this._password = password;
    this.defaults = {};
    Object.assign(this.defaults, defaults);
  }

  addHeaders(headers) {
    headers.Authorization = `Basic ${new Buffer((this._username + ':' + this._password) || '').toString('base64')}`;
  }

  toXML() {
    return '';
  }

  addOptions(options) {
    return Object.assign(options, this.defaults);
  }
}
module.exports = BasicAuthSecurity;
