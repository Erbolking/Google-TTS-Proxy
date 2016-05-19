var http = require('http'),
    proxy = require('./src/proxy'),
    port = process.env.PORT || 3000,
    exec = require('child_process').exec,
    timeout = 25000,
    maxAttempts = 20,
    attempts = {};

/**
 * Makes requests until suitable result
 * @param {object} res
 * @param {string} url
 * @param {boolean} [useTor]
 */
function makeRequest(res, url, useTor) {
    proxy(url, useTor || false)
        .on('response', (proxyRes) => {
            if (proxyRes.statusCode === 200) {
                // apply headers
                for (var header in proxyRes.headers) {
                    if (proxyRes.headers.hasOwnProperty(header)) {
                        res.setHeader(header, proxyRes.headers[header]);
                    }
                }

                proxyRes.pipe(res);

                // reset attempts;
                delete attempts[url];
            } else {
                sendFallBackRequest(res, url, useTor);
            }
        })
        .on('error', (error) => {
            console.log(error);
            sendFallBackRequest(res, url, useTor);
        });
}

/**
 * Send requests using TOR
 * @param {object} res
 * @param {string} url
 * @param {boolean} isTorAlreadyUsed
 * @returns {*}
 */
function sendFallBackRequest(res, url, isTorAlreadyUsed) {
    if (attempts[url] && maxAttempts <= attempts[url]) {
        return sendJSON(res, 'Too many attempts');
    }

    // increment attempts
    attempts[url] = (attempts[url] || 0) + 1;

    // if we already used TOR change IP address
    if (isTorAlreadyUsed) {
        console.log('ip changed');
        exec('sudo killall -HUP tor');
    }

    // send request using TOP
    console.log('try again using TOR' + url);
    makeRequest(res, url, true);
}

/**
 * Sends json to server
 * @param {object} res
 * @param {*} json
 */
function sendJSON(res, json) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
        error: json
    }));
}

// bootstrap
http.createServer((req, res) => {
    // set cross origin headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', false);

    // set timeout
    res.setTimeout(timeout);

    try {
        makeRequest(res, req.url);
    } catch (error) {
        sendJSON(res, error.message);
    }
}).listen(port);

console.log('listening ' + port);