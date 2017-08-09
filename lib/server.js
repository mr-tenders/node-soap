/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

"use strict";

function getDateString(d) {
  function pad(n) {
    return n < 10 ? '0' + n : n;
  }
  return d.getUTCFullYear() + '-'
    + pad(d.getUTCMonth() + 1) + '-'
    + pad(d.getUTCDate()) + 'T'
    + pad(d.getUTCHours()) + ':'
    + pad(d.getUTCMinutes()) + ':'
    + pad(d.getUTCSeconds()) + 'Z';
}

let url = require('url'),
  compress = null,
  events = require('events'),
  util = require('util'),
  findPrefix = require('./utils').findPrefix;

try {
  compress = require("compress");
} catch (error) {
}

let Server = function (server, path, services, wsdl, options) {
  let self = this;

  events.EventEmitter.call(this);

  options = options || {};
  this.path = path;
  this.services = services;
  this.wsdl = wsdl;
  this.suppressStack = options && options.suppressStack;
  this.returnFault = options && options.returnFault;

  if (path[path.length - 1] !== '/')
    path += '/';
  wsdl.onReady(function (err) {
    if (typeof server.route === 'function' && typeof server.use === 'function') {
      //handle only the required URL path for express server
      server.route(path).all(function (req, res, next) {
        if (typeof self.authorizeConnection === 'function') {
          if (!self.authorizeConnection(req)) {
            res.end();
            return;
          }
        }
        self._requestListener(req, res);
      });
    } else {
      let listeners = server.listeners('request').slice();
      server.removeAllListeners('request');
      server.addListener('request', function (req, res) {
        if (typeof self.authorizeConnection === 'function') {
          if (!self.authorizeConnection(req)) {
            res.end();
            return;
          }
        }
        let reqPath = url.parse(req.url).pathname;
        if (reqPath[reqPath.length - 1] !== '/') {
          reqPath += '/';
        }
        if (path === reqPath) {
          self._requestListener(req, res);
        } else {
          for (let i = 0, len = listeners.length; i < len; i++) {
            listeners[i].call(this, req, res);
          }
        }
      });
    }
  });

  this._initializeOptions(options);
};
util.inherits(Server, events.EventEmitter);

Server.prototype.addSoapHeader = function (soapHeader, name, namespace, xmlns) {
  if (!this.soapHeaders) {
    this.soapHeaders = [];
  }
  if (typeof soapHeader === 'object') {
    soapHeader = this.wsdl.objectToXML(soapHeader, name, namespace, xmlns, true);
  }
  return this.soapHeaders.push(soapHeader) - 1;
};

Server.prototype.changeSoapHeader = function (index, soapHeader, name, namespace, xmlns) {
  if (!this.soapHeaders) {
    this.soapHeaders = [];
  }
  if (typeof soapHeader === 'object') {
    soapHeader = this.wsdl.objectToXML(soapHeader, name, namespace, xmlns, true);
  }
  this.soapHeaders[index] = soapHeader;
};

Server.prototype.getSoapHeaders = function () {
  return this.soapHeaders;
};

Server.prototype.clearSoapHeaders = function () {
  this.soapHeaders = null;
};

Server.prototype._initializeOptions = function (options) {
  this.wsdl.options.attributesKey = options.attributesKey || 'attributes';
};

Server.prototype._processRequestXml = function (req, res, xml) {
  let self = this;
  let result;
  let error;
  try {
    if (typeof self.log === 'function') {
      self.log("received", xml);
    }
    self._process(xml, req, function (result, statusCode) {
      if (statusCode) {
        res.statusCode = statusCode;
      }
      res.write(result);
      res.end();
      if (typeof self.log === 'function') {
        self.log("replied", result);
      }
    });
  } catch (err) {
    if (err.Fault !== undefined) {
      return self._sendError(err.Fault, function (result, statusCode) {
        res.statusCode = statusCode || 500;
        res.write(result);
        res.end();
        if (typeof self.log === 'function') {
          self.log("error", err);
        }
      }, new Date().toISOString());
    } else {
      error = err.stack ? (self.suppressStack === true ? err.message : err.stack) : err;
      res.statusCode = 500;
      res.write(error);
      res.end();
      if (typeof self.log === 'function') {
        self.log("error", error);
      }
    }
  }
};

Server.prototype._requestListener = function (req, res) {
  let self = this;
  let reqParse = url.parse(req.url);
  let reqPath = reqParse.pathname;
  let reqQuery = reqParse.search;

  if (typeof self.log === 'function') {
    self.log("info", "Handling " + req.method + " on " + req.url);
  }

  if (req.method === 'GET') {
    if (reqQuery && reqQuery.toLowerCase() === '?wsdl') {
      if (typeof self.log === 'function') {
        self.log("info", "Wants the WSDL");
      }
      res.setHeader("Content-Type", "application/xml");
      res.write(self.wsdl.toXML());
    }
    res.end();
  } else if (req.method === 'POST') {
    if (typeof req.headers['content-type'] !== "undefined") {
      res.setHeader('Content-Type', req.headers['content-type']);
    } else {
      res.setHeader('Content-Type', "application/xml");
    }

    //request body is already provided by an express middleware
    //in this case unzipping should also be done by the express middleware itself
    if (req.body) {
      return self._processRequestXml(req, res, req.body.toString());
    }

    let chunks = [], gunzip;
    if (compress && req.headers["content-encoding"] === "gzip") {
      gunzip = new compress.Gunzip();
      gunzip.init();
    }
    req.on('data', function (chunk) {
      if (gunzip)
        chunk = gunzip.inflate(chunk, "binary");
      chunks.push(chunk);
    });
    req.on('end', function () {
      let xml = chunks.join('');
      let result;
      let error;
      if (gunzip) {
        gunzip.end();
        gunzip = null;
      }
      self._processRequestXml(req, res, xml);
    });
  }
  else {
    res.end();
  }
};

Server.prototype._process = function (input, req, callback) {
  let self = this,
    pathname = url.parse(req.url).pathname.replace(/\/$/, ''),
    obj = this.wsdl.xmlToObject(input),
    body = obj.Body,
    headers = obj.Header,
    bindings = this.wsdl.definitions.bindings, binding,
    method, methodName,
    serviceName, portName,
    includeTimestamp = obj.Header && obj.Header.Security && obj.Header.Security.Timestamp;

  if (typeof self.authenticate === 'function') {
    if (!obj.Header || !obj.Header.Security) {
      throw new Error('No security header');
    }
    if (!self.authenticate(obj.Header.Security)) {
      throw new Error('Invalid username or password');
    }
  }

  if (typeof self.log === 'function') {
    self.log("info", "Attempting to bind to " + pathname);
  }

  //Avoid Cannot convert undefined or null to object due to Object.keys(body)
  //and throw more meaningful error
  if (!body) {
    throw new Error('Failed to parse the SOAP Message body');
  }

  // use port.location and current url to find the right binding
  binding = (function (self) {
    let services = self.wsdl.definitions.services;
    let firstPort;
    let name;
    for (name in services) {
      serviceName = name;
      let service = services[serviceName];
      let ports = service.ports;
      for (name in ports) {
        portName = name;
        let port = ports[portName];
        let portPathname = url.parse(port.location).pathname.replace(/\/$/, '');

        if (typeof self.log === 'function') {
          self.log("info", "Trying " + portName + " from path " + portPathname);
        }

        if (portPathname === pathname)
          return port.binding;

        // The port path is almost always wrong for generated WSDLs
        if (!firstPort) {
          firstPort = port;
        }
      }
    }
    return !firstPort ? void 0 : firstPort.binding;
  })(this);

  if (!binding) {
    throw new Error('Failed to bind to WSDL');
  }

  try {
    if (binding.style === 'rpc') {
      methodName = Object.keys(body)[0];

      self.emit('request', obj, methodName);
      if (headers)
        self.emit('headers', headers, methodName);

      self._executeMethod({
        serviceName: serviceName,
        portName: portName,
        methodName: methodName,
        outputName: methodName + 'Response',
        args: body[methodName],
        headers: headers,
        style: 'rpc'
      }, req, callback);
    } else {
      let messageElemName = (Object.keys(body)[0] === 'attributes' ? Object.keys(body)[1] : Object.keys(body)[0]);
      let pair = binding.topElements[messageElemName];

      self.emit('request', obj, pair.methodName);
      if (headers)
        self.emit('headers', headers, pair.methodName);

      self._executeMethod({
        serviceName: serviceName,
        portName: portName,
        methodName: pair.methodName,
        outputName: pair.outputName,
        args: body[messageElemName],
        headers: headers,
        style: 'document'
      }, req, callback, includeTimestamp);
    }
  }
  catch (error) {
    if (error.Fault !== undefined) {
      return self._sendError(error.Fault, callback, includeTimestamp);
    }

    throw error;
  }
};

Server.prototype._executeMethod = function (options, req, callback, includeTimestamp) {
  options = options || {};
  let self = this,
    method, body,
    serviceName = options.serviceName,
    portName = options.portName,
    methodName = options.methodName,
    outputName = options.outputName,
    args = options.args,
    style = options.style,
    handled = false;

  try {
    method = this.services[serviceName][portName][methodName];
  } catch (error) {
    return callback(this._envelope('', includeTimestamp));
  }

  function handleResult(error, result) {
    if (handled)
      return;
    handled = true;

    if (error && error.Fault !== undefined) {
      return self._sendError(error.Fault, callback, includeTimestamp);
    }
    else if (result === undefined) {
      // Backward compatibility to support one argument callback style
      result = error;
    }

    if (style === 'rpc') {
      body = self.wsdl.objectToRpcXML(outputName, result, '', self.wsdl.definitions.$targetNamespace);
    } else {
      let element = self.wsdl.definitions.services[serviceName].ports[portName].binding.methods[methodName].output;
      body = self.wsdl.objectToDocumentXML(outputName, result, element.targetNSAlias, element.targetNamespace);
    }
    callback(self._envelope(body, includeTimestamp));
  }

  if (!self.wsdl.definitions.services[serviceName].ports[portName].binding.methods[methodName].output) {
    // no output defined = one-way operation so return empty response
    handled = true;
    callback('');
  }

  let result = method(args, handleResult, options.headers, req);
  if (typeof result !== 'undefined') {
    handleResult(result);
  }
};

Server.prototype._envelope = function (body, includeTimestamp) {
  let defs = this.wsdl.definitions,
    ns = defs.$targetNamespace,
    encoding = '',
    alias = findPrefix(defs.xmlns, ns);
  let xml = "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
    "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\" " +
    encoding +
    this.wsdl.xmlnsInEnvelope + '>';
  let headers = '';

  if (includeTimestamp) {
    let now = new Date();
    let created = getDateString(now);
    let expires = getDateString(new Date(now.getTime() + (1000 * 600)));

    headers += "<o:Security soap:mustUnderstand=\"1\" " +
      "xmlns:o=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\" " +
      "xmlns:u=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd\">" +
      "    <u:Timestamp u:Id=\"_0\">" +
      "      <u:Created>" + created + "</u:Created>" +
      "      <u:Expires>" + expires + "</u:Expires>" +
      "    </u:Timestamp>" +
      "  </o:Security>\n";
  }

  if (this.soapHeaders) {
    headers += this.soapHeaders.join("\n");
  }

  if (headers !== '') {
    xml += "<soap:Header>" + headers + "</soap:Header>";
  }

  xml += "<soap:Body>" +
    body +
    "</soap:Body>" +
    "</soap:Envelope>";
  return xml;
};

Server.prototype._sendError = function (soapFault, callback, includeTimestamp) {
  let self = this,
    fault;

  let statusCode;
  if (soapFault.statusCode) {
    statusCode = soapFault.statusCode;
    soapFault.statusCode = undefined;
  }

  if (soapFault.faultcode) {
    // Soap 1.1 error style
    // Root element will be prependend with the soap NS
    // It must match the NS defined in the Envelope (set by the _envelope method)
    fault = self.wsdl.objectToDocumentXML("soap:Fault", soapFault, undefined);
  }
  else {
    // Soap 1.2 error style.
    // 3rd param is the NS prepended to all elements
    // It must match the NS defined in the Envelope (set by the _envelope method)
    fault = self.wsdl.objectToDocumentXML("Fault", soapFault, "soap");
  }

  return callback(self._envelope(fault, includeTimestamp), statusCode);
};

exports.Server = Server;
