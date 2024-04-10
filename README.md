# Mist

A barebones library for interacting with cloud variable servers.

What Mist will do for you:

 - A simple event-driven API
 - Automatic reconnection if the server restarts
 - Strict input validation to detect bad code early
 - Forces you to provide a valid User-Agent (if used in Node.js)

What Mist won't do for you:

 - Encode or decode strings/lists/etc. as numbers. We just provide the means to talk to talk to cloud variables. You have to provide encoding and decoding on your own.
 - Authentication, for example to connect to clouddata.scratch.mit.edu.
 - Interacting with any other API. It's just cloud variables.
 - A lot of customization options. We're trying to keep it simple. Mist is small enough and has few enough dependencies that forking it to meet your needs shouldn't be that hard.
 - Rate limiting. Be reasonable, okay?

You are expected to read https://docs.turbowarp.org/cloud-variables#advanced before using Mist.

## Usage in Node.js

Install:

```bash
npm install @turbowarp/mist
```

Simple usage:

```js
const Mist = require('@turbowarp/mist');

const connection = new Mist({
    // Can be any text, not just numbers
    projectId: '',

    // You must add your contact information here; see https://docs.turbowarp.org/cloud-variables#user-agent
    userAgent: '',

    // You can also send a username if you want but we recommend just using the default which is guaranteed
    // to always work.
    // username: 'player2345',

    // You can specify a different cloud host here:
    // cloudHost: 'wss://clouddata.turbowarp.org',
});

connection.on('connected', () => {
    // Event is fired each time a connection is successfully opened
    // Note that at this point **no variables have any values yet**
    console.log('Connected!');
});

connection.on('reconnecting', () => {
    // Event is fired each time a connection is lost (server restart, internet outage, etc.)
    console.log('Connection lost, trying to reconnect...');
});

connection.on('set', (name, value) => {
    // Event is fired each time a value is received for a variable
    console.log(name, 'was set to', value);
});

connection.on('error', (error) => {
    // Event is fired when there is an unrecoverable error. At this point the connection
    // is permanently terminated and will not automatically reconnect. Examples include
    // an invalid username or invalid User-Agent but do not include a server restart
    // (as that will trigger the reconnection logic instead).
    console.error(error);
});

const interval = setInterval(() => {
    // Instead of event-driven APIs, you can also use get() which returns the most recently
    // received or set value of a given variable. If you don't include "☁ " then we will add
    // it for you. Unknown variables return `undefined`.
    const value = connection.get('my variable') || 0;

    if (value >= 30) {
        // close() will immediately end the connection. No events will be fired.
        connection.close();
        console.log('Closing!');
        clearInterval(interval);
    } else {
        // Update a variable by calling set() anywhere. Like get(), if you don't include "☁ "
        // then we will add it for you. If called before the connection is opened, it will be
        // saved in a queue to be sent when the connection opens.
        connection.set('my variable', value + 1);
        console.log('☁ my variable is being set to', connection.get('☁ my variable'));
    }
}, 1000);
```

## Usage in browsers

It should work if you use a build tool like webpack. Only difference is that the User-Agent is not required (and is in fact ignored). Standalone script tag version to come eventually.

## License

This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
