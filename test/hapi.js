//
// # Hapi
//
// Tests will hang if an error is thrown inside .inject()... probably some
// internal error handler in Hapi..
//

var assert = require('assert');
var hapi   = require('hapi');
var pkg    = require('../package.json');
var sess   = require('../');

suite('Hapi Integration', function () {
  test('Loads session', function (done) {
    var server = new hapi.Server(0);
    server.route({
      method: 'GET',
      path: '/',
      handler: function (request, reply) {
        request.session.set('bar', 'baz');
        reply(request.session.data);
      }
    });

    server.pack.plugins['bloglovin-memcached-sharder'] = mockMC();

    var plugin = {
      name: pkg.name,
      version: pkg.version,
      register: sess.register
    };
    server.pack.register(plugin, {}, function doTest(err) {
      assert(!err);

      var headers = {
        'Cookie': 'session=foo'
      };
      server.inject({ url: '/', headers: headers }, function r(res) {
        assert.equal(res.result.bar, 'baz');
        done();
      });
    });
  });

  test('Creates a new session', function (done) {
    var server = new hapi.Server(0);
    server.route({
      method: 'GET',
      path: '/',
      handler: function (request, reply) {
        request.session.set('bar', 'baz');
        reply(request.session.data);
      }
    });

    server.pack.plugins['bloglovin-memcached-sharder'] = mockMC();

    var plugin = {
      name: pkg.name,
      version: pkg.version,
      register: sess.register
    };
    server.pack.register(plugin, { create: true }, function doTest(err) {
      assert(!err);

      server.inject({ url: '/' }, function r(res) {
        assert(res.headers['set-cookie']);
        done();
      });
    });
  });

  test('Destroying a session', function (done) {
    var server = new hapi.Server(0);
    server.route({
      method: 'GET',
      path: '/',
      handler: function (request, reply) {
        request.session.destroy(function (err) {
          assert(!err);
          reply(request.session.data);
        });
      }
    });

    server.pack.plugins['bloglovin-memcached-sharder'] = mockMC();

    var plugin = {
      name: pkg.name,
      version: pkg.version,
      register: sess.register
    };
    server.pack.register(plugin, { create: true }, function doTest(err) {
      assert(!err);

      server.inject({ url: '/' }, function r(res) {
        assert(res.headers['set-cookie']);
        var cookie = res.headers['set-cookie'][0].split(';');
        var expires = false;
        for (var i = 0; i < cookie.length; i++) {
          var parts = cookie[i].split('=');
          if (parts[0].trim() === 'Expires') {
            expires = parts[1];
            break;
          }
        }

        assert(expires);
        var exp = new Date(expires);
        var now = new Date();
        assert(exp.getTime() < now.getTime());
        done();
      });
    });
  });
});

function mockMC() {
  return {
    connection: function () {
      return {
        data: {},
        get: function (key, callback) {
          var val = { foo: 'bar', beep: 'boop' };
          callback(val);
        },
        set: function (key, value, ttl, callback) {
          this.data[key] = value;
          callback();
        },
        remove: function (key, callback) {
          callback('foo');
        }
      };
    }
  };
}

