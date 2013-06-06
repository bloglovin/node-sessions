var assert = require('assert')
	, options = require('./options.json')
  , memcached = require('./../index')(options);

suite('memcached', function() {
  test('Simple integer value should be set', function(done) {
    memcached.set('mocha_test_key', 15, 30, function (resp) {
      memcached.get('mocha_test_key', function (resp) {
        assert.equal(15, resp);
        memcached.remove('mocha_test_key', function (resp) {
          done();
        });
      });
    });
  });

  test('JSON should be set and decoded properly', function(done) {
    var dummy_data = {
      'interesting': {
        'object': 'hasobject'
      },
      'also': 'hasnot'
    };

    memcached.set('mocha_test_key', dummy_data, 30, function (resp) {
      memcached.get('mocha_test_key', function (resp) {
        assert.deepEqual(dummy_data, resp);
        memcached.remove('mocha_test_key', function (resp) {
          done();
        });
      });
    });
  });
});