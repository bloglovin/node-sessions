session-handler
==========
A simple session handler and cookie parser for node using memcached for session storage.

Install
-------

    npm install

Documentation
------

TODO

Examples
------

```javascript
var mem_options = require('./options.json')
  , memcached = require('memcached-wrapper')(mem_options)
  , ses_options = {'prefix':'test'}
  , sessions = require('./../index')(memcached, ses_options);

sessions.start(req, resp, function(err, resp) {
  // If no error, we have a valid session
  var value = sessions.get(':SESSION_NAME')

  sessions.set(':SESSION_NAME', 'bar', function (err, resp) {
    // If no error, session is now set and saved in memcached
  });
});
```

Test
------
Depends on mocha, run

    make test