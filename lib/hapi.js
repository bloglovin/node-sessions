//
// # Hapi Integration
//
// Implement the Hapi plugin interface.
//

/* jslint node: true */
'use strict';

var session = require('../');

var defaults = {
  version: 2,
  cookiePrefix: '',
  sessionTTL: 24 * 3600 * 1000,
  autoSave: false,
  create: false,
  cookieOptions: {
    path: '/',
    ttl: 7 * 24 * 3600 * 1000,
    isSecure: true
  }
};

module.exports = function registerSession(plugin, options, next) {
  var settings = plugin.hapi.utils.applyToDefaults(defaults, options);
  var mc       = plugin.plugins['bloglovin-memcached-sharder'].connection();
  plugin.state('session', settings.cookieOptions);

  // Load session
  plugin.ext('onPreAuth', function sessionPreAuth(request, reply) {
    var conf = plugin.hapi.utils.clone(settings);

    // Function used by the session module to set a cookie
    function cookieSetter(name, value) {
      reply.state(name, value);
    }

    // Function used by the session module to remove a cookie
    function cookieRemover(name) {
      reply.state(name, '', {
        ttl: -(3600 * 1000)
      });
    }

    conf.cookieSetter  = cookieSetter;
    conf.cookieRemover = cookieRemover;

    request.session = new session(mc, conf);
    request.session.start(request.state, conf.create, reply);
  });

  // Save session
  plugin.ext('onPostHandler', function sessionPostHandle(request, reply) {
    request.session.end(reply);
  });

  next();
};

