//
// # Session
//

/* jslint node: true */
'use strict';

var assert = require('assert');
var uuid   = require('uuid');

//
// ## Setup Session
//
// Prepares a new session.
//
// The cookie setting and getting is abstracted from this module to allow it to
// be used in different environments. Hence the `cookieX` options below are
// required.
//
// * **mc**, an instance of `bloglovin-memcached-sharder`.
// * **opts**, an options object containing:
//  * **version**, the session version.
//  * **prefix**, cookie prefix.
//  * **sessionTTL**, how long a session should be valid.
//  * **cookieSetter**, a function that takes two arguments; name and value.
//    This function should save a cookie with the given name and value. This
//    option is **required**.
//  * **cookieRemover**, a function that takes the name of a cookie to destroy.
//    This option is **required**.
//  * **autoSave**, if true each set triggers a set in memcached. Otherwise
//    sessions are not persisted until `.save()` or `.end()` is called.
//
var Session = module.exports = function Session(mc, opts) {
  opts = opts || {};

  this.mc            = mc;
  this.sessionID     = null;
  this.sessionNoPref = null;
  this.data          = {};
  this.changed       = false;
  this.version       = opts.version || 2;
  this.cookiePrefix  = opts.prefix || '';
  this.cookieSetter  = opts.cookieSetter || false;
  this.cookieRemover = opts.cookieRemover || false;
  this.sessionTTL    = opts.sessionTTL || 86400;
  this.autoSave      = opts.autoSave || false;
  this.noop          = function () {};

  assert(this.mc, 'Missing memcached connection.');
  assert(this.cookieSetter, 'Missing required `cookieSetter` function.');
  assert(this.cookieRemover, 'Missing required `cookieRemover` function.');

};

//
// ## Start Session
//
// Starts a session. Checks cookie for existing one, otherwise creates a new
// session unless `create` is set to false.
//
// * **cookies**, an object containing the parsed cookies of a request.
// * **create**, boolean that determines wether or not to force creation of
//   new sessions should one not already exist for the user.
// * **next**, callback.
//
Session.prototype.start = function start(cookies, create, next) {
  var cookieName = this._prefixCookie('session');
  var session    = cookies[cookieName];

  if (!session && !create) {
    next(new Error('No session cookie found.'));
    return;
  }
  else if (!session && create) {
    this.create(next);
    return;
  }

  var self = this;
  this.sessionNoPref = session;
  this.sessionID = this.version + '::' + session;
  this.mc.get(this.sessionID, function sessionLoadCallback(sess) {
    if (!sess && !create) {
      next(new Error('No session found.'));
      return;
    }
    else if (!sess && create) {
      self.create(next);
      return;
    }

    self.data = sess;
    next(null);
  });
};

//
// ## Create Session
//
// Creates a new session by generating a session id and storing it in
// memcached.
//
// * **next**, optional callback passed to `.save()` if `autoSave` is enabled.
//
Session.prototype.create = function create(next) {
  this.sessionNoPref = uuid.v1() + uuid.v4();
  this.sessionID = this.version + '::' + this.sessionNoPref;
  this.cookieSetter(this._prefixCookie('session'), this.sessionNoPref);
  this.changed = true;
  if (this.autoSave) {
    this.save(next);
  }
  else {
    next();
  }
};

//
// ## Save Session
//
// Persists session data to memcached.
//
// * **next**, function called when done or on error.
//
Session.prototype.save = function save(next) {
  var self = this;
  var callback = this._mcNext(true, function (err, response) {
    if (!err) self.changed = false;
    if (next) next(err, response);
  });
  this.mc.set(this.sessionID, this.data, this.sessionTTL, callback);
};

//
// ## End Session
//
// Ending a session is not the same as destroying. This function only signifies
// the end of one request. Call this function when your response has been
// sent to the user or similar.
//
// The session will be saved.
//
Session.prototype.end = function end(next) {
  if (this.changed) {
    this.save(next);
  }
  else {
    if (next) next();
  }
};

//
// ## Destroy Session
//
// Destroys a session by removing all data from memcached and removing the
// cookie.
//
// * **next**, function called when done or on error.
//
Session.prototype.destroy = function destroy(next) {
  this.data = {};
  this.cookieRemover(this._prefixCookie('session'));
  this.mc.remove(this.sessionID, this._mcNext(true, next));
};

//
// ## Has Session Item
//
// Checks whether or not the given `key` exists in the session.
//
// * **key**, key to check for.
//
// **Returns** a boolean.
//
Session.prototype.has = function has(key) {
  return (typeof this.data[key] !== 'undefined');
};

//
// ## Get Session Item
//
// Returns a session value based on the given `key`. If `key` is not found in
// the session the optional `def` argument is returned instead.
//
// * **key**, the name of the value to return.
// * **def**, a default value to return if `key` is missing.
//
// **Returns** a session item.
//
Session.prototype.get = function get(key, def) {
  return this.has(key) ? this.data[key] : def;
};

//
// ## Set Session Item
//
// Set a session value.
//
// If `autoSave` is true the set value will be persisted immediately.
//
// * **key**, the name of the item to set.
// * **value**, the value to set.
// * **next**, optional callback, if passed session will be saved on the spot.
//
Session.prototype.set = function set(key, value, next) {
  this.data[key] = value;
  this.changed = true;
  if (this.autoSave || next) {
    this.save(next);
  }
};

//
// ## Remove Session Item
//
// Removes a session value.
//
// If `autoSave` is true the change will be persisted immediately.
//
// * **key**, the name of the item to set.
// * **next**, optional callback passed to `.save()` if `autoSave` is enabled.
//
Session.prototype.remove = function remove(key, next) {
  delete(this.data[key]);
  this.changed = true;
  if (this.autoSave) {
    this.save(next);
  }
};

// --------------------------------------------------------------------------

//
// ## Prefix Cookie Name
//
// Returns the prefixed version of a cookie name.
//
// _Internal_
//
// * **name**, name of the cookie.
//
// **Returns** a string.
//
Session.prototype._prefixCookie = function _prefixCookie(name) {
  if (this.cookiePrefix.length === 0) {
    return name;
  }

  return this.cookiePrefix + '[' + name + ']';
};

//
// ## Handle Memcached Callback
//
// The current memcached module implements some weird callback scheme where
// there's no special argument for errors. There's either one error, falsey
// value or the actual value. All in one argument, this function fixes that.
//
// * **falseIsError**, wether or not to treat false as an error.
// * **fn**, a function to wrap in the error checking magic.
//
Session.prototype._mcNext = function _mcNext(falseIsError, fn) {
  // Guard against optional callbacks not being defined.
  if (!fn) {
    fn = this.noop;
  }

  return function (response) {
    if (response instanceof Error) {
      fn(response, null);
    }
    else if (falseIsError && response === false) {
      var err = new Error('Memcached request failed.');
      fn(err, response);
    }
    else {
      fn(null, response);
    }
  };
};

// --------------------------------------------------------------------------

//
// ## Hapi Integration
//
// Add Hapi register function.
//
Session.register = require('./lib/hapi');

