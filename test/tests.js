var assert = require('assert')
	, mem_options = require('./options.json')
  , memcached = require('memcached-wrapper')(mem_options)
  , ses_options = {'prefix':'test'}
  , sessions = require('./../index')(memcached, ses_options);

suite('Cookies', function() {
  test('Prefix should work', function (done) {
    var name = 'cookiename';
    assert.equal('test[' + name + ']', sessions._prefixCookieName(name));
    done();
  });

  test('Parse cookies + getCookie + hasCookie', function (done) {
    var req = {
      headers: {
        cookie: 'test[foo]=bar'
      }
    };

    sessions._parseCookies(req);
    var cookie = sessions.getCookie('foo');
    assert.equal('bar', cookie);
    assert(sessions.hasCookie('foo'));

    // sessions.removeCookie('foo');
    // assert(false, sessions.hasCookie('foo'))
    done();
  });
});