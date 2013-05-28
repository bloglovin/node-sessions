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
  this.cookies = new Array();
  this.ses_updated = false;
  this.cookie_prefix = config.prefix || '';
  this.cookie_ttl = config.cookie_ttl || 2419200;
  this.session_ttl = config.session_ttl || 86400;
  this.def_domain = config.domain || '';
  
  var self = this;

  // Look for cookie, if exists, load sessions from mc
  loadSession = function loadSession(cb) {
    if (self.hasCookie('session')) {
      self.session_id = self.getCookie('session');

      self.Mc.get(this.session_id, function(resp) {
        if (resp === false) {
          createSession(cb);
        } else {
          self.sessions = resp;
        }
      });
    } else {
      createSession(cb);
    }
  }

  // Generates a random ses id and sets a cookie
  var createSession = function createSession(cb) {
    self.session_id = 'ses_' + uuid.v1() + uuid.v4();

    self.set('session_id', self.session_id, function(err, resp) {
      if (err) {
        cb(err, resp);
        return;
      }

      self.setCookie('session', self.session_id, this.session_ttl);
      cb(err, resp);
    });
  }

  // Store sessions in memcached
  saveSessions = function saveSessions(cb) {
    self.Mc.set(self.session_id, self.sessions, self.session_ttl, function(resp) {
      if (resp === false) {
        var error = new Error('SESSION_SAVE_FAILED');
        error.http_code = 503;
        handleCallback(error, resp, cb);
        return;
      }

      handleCallback(undefined, resp, cb);
    });
  }

  // Parse cookies from request and populate the cookies object
  parseCookies = function parseCookies(req) {
    req.headers.cookie &&
    req.headers.cookie.split(';').forEach(function (cookie) {
      var parts = cookie.split('=');
      self.cookies[ parts[ 0 ].trim() ] = ( parts[ 1 ] || '' ).trim();
    });
  }

  handleCallback = function handleCallback(err, resp, cb) {
    if (typeof(cb) == 'function') {
      cb(err, resp);
    } else {
      throw new Error('NO_CALLBACK');
    }
  }

}

// Start session handling and load sessions into this.sessions obj
MemcachedSession.prototype.start = function start(req, resp, cb) {
  if ( ! req || ! resp) {
    throw new Error('MISSING_ARGUMENTS');
  }

  this.resp = resp;
  this.req = req;
  loadSession(cb);
  parseCookies(req);
}

// Not implemented. Simons fault
MemcachedSession.prototype.end = function end() {}

// DESTROY (removes all sessions and unsets the session cookie)
MemcachedSession.prototype.destroy = function destroy() {
  this.sessions = {};
  self.removeCookie('session');
  this.Mc.remove(this.session_id, function(err, resp) {});
}

// Get a session by key name
// Will throw exception if session does not exist
// Use has()!
MemcachedSession.prototype.get = function get(name) {
  if ( ! this.sessions[name]) {
    var error = new Error('INVALID_SESSION_NAME');
    error.http_code = 400;
    throw error;
  }

  return this.sessions[name];
}

// Check if a session exists
MemcachedSession.prototype.has = function has(name) {
  if (this.sessions[name]) {
    return true;
  }

  return false;
}

MemcachedSession.prototype.set = function set(name, value, cb) {
  this.sessions[name] = value;
  saveSessions(cb);
}

MemcachedSession.prototype.remove = function remove(name, cb) {
  delete this.sessions[name];
  saveSessions(cb);
}

// Remove all cookies, on multiple domains,
// that are affiliated with bloglovin
MemcachedSession.prototype.destroyCookies = function destroyCookies() {
  // Get current domain but strip out port
  var domain = this.req.headers.host.replace(new RegExp(':[0-9]*'), '');

  for (key in this.cookies) {
    this.removeCookie(key, domain);
    this.removeCookie(key);
  }
}

// Get cookie by name. If name doesn't exist, throw error
MemcachedSession.prototype.getCookie = function getCookie(name) {
  if ( ! this.cookies[name]) {
    throw new Error('INVALID_COOKIE_NAME');
  }

  return this.cookies[name];
}

// check if a cookie exists, returns bool
MemcachedSession.prototype.hasCookie = function hasCookie(name) {
  if (this.cookies[name]) {
    return true;
  }

  return false;
}

// Set a cookie, add it to the response headers
MemcachedSession.prototype.setCookie = function setCookie(
  name, value, ttl, domain
) {
  if ( ! name || ! value) {
    throw new Error('COOKIE_NO_NAME');
  }

  name = this.cookie_prefix+'['+name+']';
  var date = new Date(Date.now + ttl);
  var domain = domain || this.req.headers.host.replace(new RegExp(':[0-9]*'), '');
  //this.def_domain;
  var ttl = ttl || this.cookie_ttl;

  var cookie = [
    name+'='+value,
    'Expires='+date,
    'Path=/',
    'Domain='+domain,
    'HttpOnly'
  ].join(';')

  this.cookies[name] = value;

  // Get cookies already set in this reponse
  cookies_set = this.resp.getHeader('set-cookie');

  if (typeof(cookies_set) != 'object') {
    if (cookies_set) {
      var tmp_cookie = cookies_set;
    }
    
    cookies_set = new Array();
  } 
    
  cookies_set.push(cookie);
  
  if (tmp_cookie) {
    cookies_set.push(tmp_cookie);  
  }

  // Set the header again
  this.resp.setHeader('Set-Cookie', cookies_set);
}

// Remove a cookie by setting it to an empty value with expiration now
MemcachedSession.prototype.removeCookie = function removeCookie(name, domain) {
  var domain = domain || this.def_domain;

  this.setCookie(name, '', -86400, domain);  
}

// Return a new session handler
module.exports = function (Mc, config) {
  return new MemcachedSession(Mc, config);
}
