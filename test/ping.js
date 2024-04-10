/*! This Source Code Form is subject to the terms of the Mozilla Public
 *  License, v. 2.0. If a copy of the MPL was not distributed with this
 *  file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const CloudConnection = require('../src/connection');

const connection = new CloudConnection({
    projectId: '760266457',
    userAgent: 'Crazy'
});

connection.on('connected', () => {
    console.log('Connected!');
});

connection.on('reconnecting', () => {
    console.log('Reconnecting...');
});

connection.on('set', (name, value) => {
    console.log(name, 'was set to', value);
    console.log(connection.get(name));
});

connection.on('error', (error) => {
    console.error('Error :(', error);
});
