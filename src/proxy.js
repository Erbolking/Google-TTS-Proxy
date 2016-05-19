'use strict';

/**
 * Proxy stuntman
 */

var request = require('request'),
    Agent = require('socks5-https-client/lib/Agent'),
    url = require('url'),
    torHost = process.env.TOR_HOST || 'localhost',
    torPort = process.env.TOR_PORT || 9050,
    ttsUrl = 'https://translate.google.com/translate_tts?ie=UTF-8&rate=22050&client=tw-ob';

/**
 * Calls specified url using TOR
 * @param {string} uri
 * @param {boolean} [useTor]
 * @returns {*}
 */
function call(uri, useTor) {
    if (!uri) {
        throw new Error('Please specify a uri');
    }

    var urlParts = url.parse(uri, true),
        query = urlParts.query;

    if (!query['q']) {
        throw new Error('Please specify a text to speech');
    }

    if (!query['l']) {
        throw new Error('Please specify a locale');
    }

    var options = {
        url: ttsUrl + '&q=' + query['q'] + '&tl=' + query['l']
    };

    if (useTor) {
        options['agentClass'] = Agent;
        options['strictSSL'] = false;
        options['agentOptions'] = {
            socksHost: torHost,
            socksPort: torPort
        };
    }

    return request.get(options);
}

module.exports = call;