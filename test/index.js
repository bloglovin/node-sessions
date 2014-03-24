//
// # Test Session
//

var assert  = require('assert');
var async   = require('async');
var session = require('../');

suite('Session', function sessionSuite() {
  test('Throws on missing required arguments', function throwsOnMissing() {
    assert.throws(function missingMC() {
      new session(null, {
        cookieSetter: function () {},
        cookieRemover: function () {}
      });
    }, /Missing memcached connection/);

    assert.throws(function missingMC() {
      new session('foo', {
        cookieRemover: function () {}
      });
    }, /Missing required `cookieSetter` function./);

    assert.throws(function missingMC() {
      new session('foo', {
        cookieSetter: function () {}
      });
    }, /Missing required `cookieRemover` function./);

    assert.throws(function missingMC() {
      new session('foo');
    }, /Missing required `cookieSetter` function./);
  });

  test('Start, no cookie, no create returns error', function startNoCookie(done) {
    var s = new session(mockMC(), {
      prefix: 'no-cookie',
      cookieSetter: cookieSetter,
      cookieRemover: cookieRemover
    });

    s.start(cookies(), false, function sessionNotCreated(err) {
      assert(err);
      assert.equal(err.message, 'No session cookie found.');
      done();
    });
  });

  test('Start, no cookie, create', function startNoCookie(done) {
    var calledCookieSetter = false;
    var s = new session(mockMC(), {
      prefix: 'no-cookie',
      autoSave: true,
      cookieSetter: function (val, key) {
        calledCookieSetter = true;
      },
      cookieRemover: cookieRemover
    });

    s.start(cookies(), true, function sessionCreated(err) {
      assert(calledCookieSetter, 'Did not call cookie setter');
      done();
    });
  });

  test('Start, no cookie, create. Autosave not called', function startNoCookie(done) {
    var s = new session(mockMC(), {
      prefix: 'no-cookie',
      autoSave: false,
      cookieSetter: cookieSetter,
      cookieRemover: cookieRemover
    });

    s.start(cookies(), true, function sessionCreated(err) {
      assert(s.changed, 'Did save.');
      done();
    });
  });

  test('Start, no session, no create returns error', function startNoCreate(done) {
    var s = new session(mockMC(), {
      prefix: 'no-create',
      cookieSetter: cookieSetter,
      cookieRemover: cookieRemover
    });

    s.start(cookies(), false, function sessionNotCreated(err) {
      assert(err);
      assert.equal(err.message, 'No session found.');
      done();
    });
  });

  test('Start, no session, creates new session', function startCreate(done) {
    var calledCookieSetter = false;
    var s = new session(mockMC(), {
      prefix: 'create',
      autoSave: true,
      cookieSetter: function (val, key) {
        calledCookieSetter = true;
      },
      cookieRemover: cookieRemover
    });

    s.start(cookies(), true, function sessionCreated(err) {
      assert(calledCookieSetter, 'Did not call cookie setter');
      done();
    });
  });

  test('Start, old session', function startOld(done) {
    var calledCookieSetter = false;
    var s = new session(mockMC(), {
      prefix: 'sess',
      autoSave: true,
      cookieSetter: cookieSetter,
      cookieRemover: cookieRemover
    });

    s.start(cookies(), true, function sessionCreated(err) {
      assert(!err);
      assert(s.get('foo'));
      done();
    });
  });

  test('Setting and getting values', function getting() {
    var s = new session(mockMC(), {
      cookieSetter: cookieSetter,
      cookieRemover: cookieRemover
    });

    s.set('foo', 'bar');
    assert(s.data.foo, 'bar');
    assert.equal(s.get('foo'), 'bar');
    assert.equal(s.get('bar', 'bar'), 'bar');
    assert.equal(s.get('barfoo'), null);
    assert(s.has('foo'));
    assert(!s.has('bar'));
  });

  test('Prefixing without prefix leaves out brackets', function noPrefix() {
    var s = new session(mockMC(), {
      cookieSetter: cookieSetter,
      cookieRemover: cookieRemover
    });

    assert.equal(s._prefixCookie('session'), 'session');
  });

  test('Callback wrapping does it\'s job', function callbackWrap(done) {
    var s = new session(mockMC(), {
      cookieSetter: cookieSetter,
      cookieRemover: cookieRemover
    });

    // Should return a function even though it's left out
    var fn = s._mcNext(false);
    assert.doesNotThrow(fn);
    fn();

    // Accepts errors
    async.series([
      function (next) {
        var err = new Error('foo');
        var fn2 = s._mcNext(false, function (err, response) {
          assert.equal(response, null);
          assert(err);
          next();
        });
        fn2(err);
      },
      function (next) {
        var fn3 = s._mcNext(true, function (err, response) {
          assert.equal(response, false);
          assert(err);
          assert.equal(err.message, 'Memcached request failed.');
          next();
        });
        fn3(false);
      }
    ], done);
  });

  test('Removing works', function remove() {
    var s = new session(mockMC(), {
      cookieSetter: cookieSetter,
      cookieRemover: cookieRemover
    });

    s.set('foo', 'bar');
    assert.equal(s.get('foo'), 'bar');
    s.remove('foo');
    assert.equal(s.get('foo'), undefined);
  });

  test('Destroying the session works', function destroy(done) {
    var calledCookieRemove = false;
    var s = new session(mockMC(), {
      prefix: 'sess',
      autoSave: false,
      cookieSetter: function (val, key) {
      },
      cookieRemover: function (val) {
        assert.equal(val, 'sess[session]');
        calledCookieRemove = true;
      }
    });

    s.start(cookies(), true, function sessionDestroyed(err) {
      s.destroy(function destroy(err, response) {
        assert(calledCookieRemove, 'Did not remove cookie');
        assert.equal(s.data.foo, undefined);
        done();
      });
    });
  });

  test('Autosaving works', function autoSave(done) {
    var s = new session(mockMC(), {
      prefix: 'create',
      autoSave: true,
      cookieSetter: cookieSetter,
      cookieRemover: cookieRemover
    });

    async.series([
      function start(next) {
        s.start(cookies(), true, function (err) {
          assert(!err);
          next();
        });
      },
      function autoSaveSet(next) {
        s.set('foo', 'bar', function (err) {
          assert(!err);
          next();
        });
      },
      function autoSaveRemove(next) {
        s.remove('foo', function (err) {
          assert(!err);
          next();
        });
      }
    ], done);
  });

  test('Saving with error does not change state to unchanged', function saveErr(done) {
    var s = new session(mockMC(), {
      prefix: 'sess',
      cookieSetter: cookieSetter,
      cookieRemover: cookieRemover
    });

    s.changed = true;
    s.set('save-error', true);
    s.save(function (err) {
      assert(s.changed);
      assert(err);
      done();
    });
  });

  test('Ending a session works', function ending(done) {
    var s = new session(mockMC(), {
      prefix: 'sess',
      cookieSetter: cookieSetter,
      cookieRemover: cookieRemover
    });

    async.series([
      function (next) {
        s.changed = false;
        s.end();
        next();
      },
      function (next) {
        s.changed = false;
        s.end(next);
      },
      function (next) {
        s.changed = true;
        s.end(function (err) {
          assert(!err);
          assert(!s.changed);
          next();
        });
      }
    ], done);
  });
});

// --------------------------------------------------------------------------

function mockMC() {
  return {
    data: {},
    get: function (key, callback) {
      var val = false;
      if (key === '2::no-sess') {
        val = false;
      }
      else if (key === '2::new') {
        val = false;
      }
      else if (key === 'sess') {
        val = {
          'foo': 'bar'
        };
      }
      else {
        val = this.data[key];
      }

      callback(val);
    },
    set: function (key, value, ttl, callback) {
      this.data[key] = value;
      var err = null;
      if (value['save-error']) {
        err = false;
      }
      callback(err);
    },
    remove: function (key, callback) {
      callback('foo');
    }
  };
}

function cookies() {
  return {
    'no-create[session]': 'no-sess',
    'create[session]': 'new',
    'sess[session]': 'sess'
  };
}

function cookieSetter(name, value) {

}

function cookieRemover(name, value) {

}

