"use strict";

class BearerSecurity {
  constructor(token, defaults = {}) {
    this._token = token;
    this.defaults = {};
    Object.assign(this.defaults, defaults);
  }

  addOptions(options) {
    return Object.assign(options, this.defaults);
  }

  toXML() {
    return '';
  }
}

module.exports = BearerSecurity;
