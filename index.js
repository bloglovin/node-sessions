// @fileoverview Session handler

// Depends on uuid
var uuid = require('uuid');

/**
 * MemcachedSession
 * A simple session and cookie handler for raw node
 *
 * @param Mc
 * @param obj config
 */
var MemcachedSession = function(Mc, config) {
  this.Mc = Mc;
  this.resp = null;
  this.req = null;
  this.session_id = null;
  this.sessions = {};
  this.cookies = {};
  this.ses_updated = false;
  this.version = config.version || 2;
  this.cookie_prefix = config.prefix || '';
  this.cookie_ttl = config.cookie_ttl || 2419200;
  this.session_ttl = config.session_ttl || 86400;
  this.def_domain = config.domain || '';

  var self = this;
};

var obj = MemcachedSession.prototype;
//
// Public methods
// 
// start, end, destroy, has, get, set, remove,
// getCookie, setCookie, hasCookie, removeCookie,
// destroyCookies
//

// Start session handling and load sessions into this.sessions obj
obj.start = function start(req, resp, cb) {
  if ( ! req || ! resp) {
    throw new Error('MISSING_ARGUMENTS');
  }

  this.resp = resp;
  this.req = req;
  this._parseCookies(req);
  this._loadSession(cb);
};

// Not implemented. Simons fault
obj.end = function end() {};

// DESTROY (removes all sessions and unsets the session cookie)
obj.destroy = function destroy() {
  this.sessions = {};
  this.removeCookie('session');
  this.Mc.remove(this.session_id, function(err, resp) {});
};

// Get a session by key name
// Will throw exception if session does not exist
// Use has()!
obj.get = function get(name) {
  if ( ! this.sessions[name]) {
    var error = new Error('INVALID_SESSION_NAME');
    error.http_code = 400;
    throw error;
  }

  return this.sessions[name];
};

// Check if a session exists
obj.has = function has(name) {
  if (this.sessions[name]) {
    return true;
  }

  return false;
};

obj.set = function set(name, value, cb) {
  this.sessions[name] = value;
  this._saveSessions(cb);
};

obj.remove = function remove(name, cb) {
  delete this.sessions[name];
  this._saveSessions(cb);
};

// Remove all cookies, on multiple domains,
// that are affiliated with bloglovin
obj.destroyCookies = function destroyCookies() {
  // Get current domain but strip out port
  var domain = this.req.headers.host.replace(new RegExp(':[0-9]*'), '');

  for (var key in this.cookies) {
    this.removeCookie(key, domain);
    this.removeCookie(key);
  }
};

// Get cookie by name. If name doesn't exist, throw error
obj.getCookie = function getCookie(name) {
  name = this._prefixCookieName(name);

  if ( ! this.cookies[name]) {
    throw new Error('INVALID_COOKIE_NAME');
  }

  return this.cookies[name];
};

// check if a cookie exists, returns bool
obj.hasCookie = function hasCookie(name) {
  name = this._prefixCookieName(name);

  if (this.cookies[name]) {
    return true;
  }

  return false;
};

// Set a cookie, add it to the response headers
obj.setCookie = function setCookie(name, value, ttl, domain) {
  if ( ! name || typeof value == 'undefined') {
    throw new Error('COOKIE_NO_NAME');
  }

  name = this._prefixCookieName(name);

  ttl = (ttl || this.cookie_ttl) * 1000;
  domain = domain || this.def_domain;
  var date = new Date(Date.now() + ttl);

  var cookie = [
    name+'='+value,
    'Expires='+date.toGMTString(),
    'Path=/',
    'Domain='+domain,
    'HttpOnly'
  ].join(';');

  this.cookies[name] = value;

  // Get cookies already set in this reponse
  cookies_set = this.resp.getHeader('set-cookie');

  var tmp_cookie;
  if (typeof(cookies_set) != 'object') {
    if (cookies_set) {
      tmp_cookie = cookies_set;
    }
    
    cookies_set = [];
  } 
    
  cookies_set.push(cookie);
  
  if (tmp_cookie) {
    cookies_set.push(tmp_cookie);  
  }

  // Set the header again
  this.resp.setHeader('Set-Cookie', cookies_set);
};

// Remove a cookie by setting it to an empty value with expiration now
obj.removeCookie = function removeCookie(name, domain) {
  domain = domain || this.def_domain;

  this.setCookie(name, '', -86400, domain);  
};

//
// Private methods
//

// Look for cookie, if exists, load sessions from mc
obj._loadSession = function _loadSession(cb) {
  if (this.hasCookie('session')) {
    this.session_id = this.version + '::' + this.getCookie('session');
    
    this.Mc.get(this.session_id, function(resp) {
      if (resp === false) {
        this._createSession(cb);
      } else {
        this.sessions = resp;
        this._handleCallback(undefined, resp, cb);
      }
    });
  } else {
    this._createSession(cb);
  }
};

// Generates a random ses id and sets a cookie
obj._createSession = function _createSession(cb) {
  this.session_id = 'ses_' + uuid.v1() + uuid.v4();

  this.set('session_id', this.session_id, function(err, resp) {
    if (err) {
      cb(err, resp);
      return;
    }

    this.setCookie('session', this.session_id, this.session_ttl);
    cb(err, resp);
  });
};

// Store sessions in memcached
obj._saveSessions = function _saveSessions(cb) {
  this.Mc.set(this.session_id, this.sessions, this.session_ttl, function(resp) {
    if (resp === false) {
      var error = new Error('SESSION_SAVE_FAILED');
      error.http_code = 503;
      handleCallback(error, resp, cb);
      return;
    }

    handleCallback(undefined, resp, cb);
  });
};

// Parse cookies from request and populate the cookies object
obj._parseCookies = function _parseCookies(req) {
  var self = this;

  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach(function (cookie) {
      var parts = cookie.split('=');
      self.cookies[ parts[ 0 ].trim() ] = ( parts[ 1 ] || '' ).trim();
    });
  }
};

// Callback wrapper, make sure it's a function
obj._handleCallback = function _handleCallback(err, resp, cb) {
  if (typeof(cb) == 'function') {
    cb(err, resp);
  } else {
    throw new Error('NO_CALLBACK');
  }
};

// Return prefixed string
obj._prefixCookieName = function _prefixCookieName(name) {
  return this.cookie_prefix + '[' + name + ']';
};

// Return a new session handler
module.exports = function (Mc, config) {
  return new MemcachedSession(Mc, config);
};

