node-memcached-wrapper
======================

A small memcached wrapper using node-memcached

Documentation
-------------
There are 4 exposed public methods

```javascript
function get(key, callback) {}
function set(key, value, ttl, callback) {}
function remove(key, callback) {}
function end() {}
```

The callback should expect one parameter, response, which will be the actual result from memcached. If false, the key did not exist, or we couldn't set the key

```javascript
function callback(resp) {
  if (resp === false) {
    // Nothing here to see
  } else {
    // Use your response
  }
}
```

The wrapper should make sure errors are handled in a preferable way although this far it seems like the node-memcached lib is completely incapable of handling errors at all. This is a problem.

Examples
-------------
**Init**

```javascript
app.Mc = require('./memcache-wrapper')(config)

app.Mc.set('test_key', 'hejsan', 1200, function(resp) {})
```

**Config**

```javascript
{
  "servers": {
    "127.0.0.1:11211":100,
    "127.0.0.1:11212":50
    "ip:port":weight
  },
  "options": {
    "maxKeySize":250,
    "maxExpiration":2592000,
    "maxValue":1048576,
    "poolSize":10,
    "algorithm":"crc32",
    "reconnect":20,
    "timeout":3,
    "retries":1,
    "retry":3,
    "remove":true,
    "keyCompression":true,
    "prefix": "prefix keys with this string, empty by default",
    "compression": "not implemented yet"
  }
}
```

More documentation of options can be found at https://github.com/3rd-Eden/node-memcached

Tests
-------

Depends on mocha being installed and memcached running on localhost on port 11211. Server can be changed in ./test/options.json

**To test**

    make test
    