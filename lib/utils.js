
"use strict";
const crypto = require('crypto');

exports.passwordDigest = function passwordDigest(nonce, created, password) {
  // digest = base64 ( sha1 ( nonce + created + password ) )
  let pwHash = crypto.createHash('sha1');
  let rawNonce = new Buffer(nonce || '', 'base64').toString('binary');
  pwHash.update(rawNonce + created + password);
  return pwHash.digest('base64');
};

const TNS_PREFIX = '__tns__'; // Prefix for targetNamespace

exports.TNS_PREFIX = TNS_PREFIX;

/**
 * Find a key from an object based on the value
 * @param {Object} xmlnsMapping Namespace prefix/uri mapping
 * @param {*} nsURI value
 * @returns {String} The matching key
 */
exports.findPrefix = function(xmlnsMapping, nsURI) {
  for (const n in xmlnsMapping) {
    if (n === TNS_PREFIX) continue;
    if (xmlnsMapping[n] === nsURI) {
      return n;
    }
  }
};
