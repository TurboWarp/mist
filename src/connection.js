/*! This Source Code Form is subject to the terms of the Mozilla Public
 *  License, v. 2.0. If a copy of the MPL was not distributed with this
 *  file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const EventEmitter = require('events');
const WebSocket = require('isomorphic-ws');
const {name, version} = require('../package.json');

/**
 * @typedef Options
 * @property {string | string[]} [cloudHost] Cloud variable servers to connect to. Can be an array or just a string.
 * @property {string|number} projectId Project ID to connect to.
 * @property {string} [userAgent] Information to include in the User-Agent header. In Node.js, this field is required and must contain your contact information. Ignored in browsers.
 * @property {string} [username] Username to use. Recommended to leave empty and let us generate a random one for you.
 */

const DEFAULT_CLOUD_HOST = [
    // Hopefully at least one of these won't be blocked?
    'wss://clouddata.turbowarp.org',
    'wss://clouddata.turbowarp.xyz'
];

const CLOUD_PREFIX = '☁ ';

/**
 * Add cloud prefix if missing.
 * @param {string} name
 * @returns {string}
 */
const toVariableName = name => {
    if (!name.startsWith(CLOUD_PREFIX)) {
        return `${CLOUD_PREFIX}${name}`;
    }
    return name;
};

/**
 * @typedef {string|number|boolean} ScratchCompatibleValue
 */

/**
 * Returns true if a value's type is compatible with Scratch.
 * Not guaranteed that the server will actually accept the value.
 * @param {unknown} value
 * @returns {value is ScratchCompatibleValue}
 */
const isScratchCompatible = value => (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
);

/**
 * @returns {string}
 */
const getRandomUsername = () => {
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `player${random}`;
};

/**
 * Equivalent to Object.hasOwn
 * @param {unknown} obj
 * @param {string} prop
 * @returns {boolean}
 */
const hasOwn = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);

class Connection extends EventEmitter {
    /**
     * @param {Options} options
     */
    constructor (options) {
        super();

        /** @type {Options} */
        this._options = options;

        // Server wants project ID as a string.
        if (typeof options.projectId === 'number') {
            options.projectId = `${options.projectId}`;
        } else if (typeof options.projectId !== 'string') {
            throw new Error(`Project ID should be a string or number: ${options.projectId}`);
        }

        if (!hasOwn(options, 'username')) {
            options.username = getRandomUsername();
        } else if (typeof options.username !== 'string') {
            throw new Error(`Username should be a string: ${options.username}`);
        }

        if (hasOwn(options, 'userAgent') && typeof options.userAgent !== 'string') {
            throw new Error(`User agent should be a string: ${options.userAgent}`);
        }

        /** @type {number} */
        this._attemptedConnections = 0;

        /** @type {string[]} */
        this._queuedMessages = [];

        /** @type {Map<string, ScratchCompatibleValue>} */
        this._mostRecentValues = new Map();

        /** @type {WebSocket|null} */
        this._ws = null;

        this._openConnection();
    }

    _openConnection () {
        const allCloudHosts = this._options.cloudHost || DEFAULT_CLOUD_HOST;
        const cloudHost = Array.isArray(allCloudHosts) ? allCloudHosts[this._attemptedConnections % allCloudHosts.length] : allCloudHosts;
        this._attemptedConnections++;

        if (typeof window === 'undefined') {
            // Node.js
            const userAgent = `${this._options.userAgent}`;
            if (!userAgent) {
                throw new Error('In Node.js, the userAgent option is required to be set. It should contain your contact information.');
            }
            this._ws = new WebSocket(cloudHost, {
                headers: {
                    'user-agent': `${name}/${version} :: ${userAgent}`
                }
            });
        } else {
            // Browser
            this._ws = new WebSocket(cloudHost);
        }

        this._ws.onopen = this._handleOpen.bind(this);
        this._ws.onmessage = this._handleMessage.bind(this);
        this._ws.onclose = this._handleClose.bind(this);
        this._ws.onerror = this._handleError.bind(this);
    }

    _handleOpen () {
        // Send handshake
        this._ws.send(JSON.stringify({
            method: 'handshake',
            project_id: this._options.projectId,
            user: this._options.username
        }));

        for (const message of this._queuedMessages) {
            this._ws.send(message);
        }
        this._queuedMessages.length = 0;

        this._attemptedConnections = 0;
        this.emit('connected');
    }

    _handleMessage (e) {
        const data = e.data;
        if (typeof data !== 'string') {
            // binary message; ignore
            return;
        }

        for (const line of data.split('\n')) {
            if (!line) continue; // ignore empty lines

            let parsed;
            try {
                parsed = JSON.parse(line);
            } catch (e) {
                this._terminate(new Error(`Received invalid JSON from server: ${line}`));
            }

            if (!parsed) {
                this._terminate(new Error(`Received invalid object from server: ${parsed}`));
            }

            if (parsed.method === 'set') {
                const {name, value} = parsed;
                if (typeof name !== 'string') {
                    this._terminate(new Error(`Received invalid name from server: ${name}`));
                }
                if (!isScratchCompatible(value)) {
                    this._terminate(new Error(`Received invalid value from server: ${name}`));
                }

                this._mostRecentValues.set(name, value);
                this.emit('set', name, value);
            }
        }
    }

    _handleClose (e) {
        this._ws = null;

        const code = e.code;
        if (code === 4002) {
            this._terminate(new Error(`Invalid username: ${this._options.username}`));
        }
        if (code === 4004) {
            this._terminate(new Error(`Cloud variables are disabled for project: ${this._options.projectId}`));
        }
        if (code === 4006) {
            this._terminate(new Error(`Invalid user agent: ${this._options.userAgent}`));
        }

        this.emit('reconnecting');

        const maxDelay = 2000 * (Math.min(this._attemptedConnections + 1, 5));
        const randomizedDelay = maxDelay * Math.random();
        this._reconnectTimeout = setTimeout(this._openConnection.bind(this), randomizedDelay);
    }

    _handleError () {
        // Don't need to do anything. We will already try to reconnect.
    }

    /**
     * @param {Error} error
     * @returns {never}
     */
    _terminate (error) {
        this.close();
        this.emit('error', error);
        throw error;
    }

    /**
     * @param {string} name Variable name. "☁ " will be added in front if you do not include it.
     * @param {ScratchCompatibleValue} value New value.
     */
    set (name, value) {
        if (typeof name !== 'string') {
            this._terminate(new Error(`Invalid variable name: ${name}`));
        }
        if (!isScratchCompatible(value)) {
            this._terminate(new Error(`Invalid variable value: ${value}`));
        }

        name = toVariableName(name);
        this._mostRecentValues.set(name, value);

        const message = JSON.stringify({
            method: 'set',
            project_id: this._options.projectId,
            user: this._options.username,
            name: name,
            value: value,
        });

        if (this._ws && this._ws.readyState === this._ws.OPEN) {
            this._ws.send(message);
        } else {
            this._queuedMessages.push(message);
        }
    }

    /**
     * Returns the most recently received or set value for a variable.
     * @param {string} name Variable name. "☁ " will be added in front if you do not include it.
     * @returns {ScratchCompatibleValue|undefined} undefined if variable is not known.
     */
    get (name) {
        if (typeof name !== 'string') {
            throw new Error(`Invalid variable name: ${name}`);
        }
        name = toVariableName(name);
        return this._mostRecentValues.get(name);
    }

    close () {
        if (this._ws) {
            this._ws.onopen = null;
            this._ws.onmessage = null;
            this._ws.onclose = null;
            this._ws.onerror = null;

            this._ws.close();
            this._ws = null;
        }

        clearTimeout(this._reconnectTimeout);
    }
}

module.exports = Connection;
