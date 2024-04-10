const Mist = require('../src/index');

const connection = new Mist({
    // Can be any text, not just numbers
    projectId: 'mist/test/example.js',

    // You must add your contact information here; see https://docs.turbowarp.org/cloud-variables#user-agent
    userAgent: 'mist/test/example.js',

    // You can also send a username if you want but we recommend just using the default which is guaranteed
    // to always work.
    // username: 'player2345',
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
