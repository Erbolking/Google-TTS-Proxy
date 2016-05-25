var http = require('http'),
    proxy = require('./src/proxy'),
    exec = require('child_process').exec,
    fs = require('fs'),
    path = require('path'),
    port = process.env.PORT || 3000,
    torContainer = process.env.TOR_CONTAINER || 'tor',
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
            } else if ([503, 302].indexOf(proxyRes.statusCode) >= 0) {
                sendFallBackRequest(res, url, useTor);
            } else {
                sendJSON(res, 'Invalid Request');
            }
        })
        .on('error', (error) => {
            console.log(error);
            if (error.code === 'ECONNREFUSED' && error.port === (process.env.TOR_PORT || 9050)) {
                // seems to be that TOR is down try to reload it
                sendFallBackRequest(res, url, useTor);
            } else {
                sendJSON(res, 'Invalid Request');
            }
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
        exec('docker restart ' + torContainer);
        //exec('sudo killall -HUP tor');
    }

    // send request using TOP
    console.log('try again using TOR' + url);
    makeRequest(res, url, true);
}

/**
 * Sends json to server
 * @param {object} res
 * @param {*} json
 * @param {number} [status]
 */
function sendJSON(res, json, status) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = status || 400;
    res.end(JSON.stringify({
        error: json
    }));
}

// bootstrap
http.createServer((req, res) => {
    // set cross origin headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');

    // handle OPTIONS
    if ('OPTIONS' === req.method) {
        res.statusCode = 204;
        res.end();
    }
    // handle crossDomain.xml
    else if (req.url.indexOf('/crossdomain.xml') >= 0) {
        fs.readFile('./crossdomain.xml', (error, content) => {
            if (!error) {
                res.writeHead(200, {'Content-Type': 'text/xml'});
                res.end(content, 'utf-8');
            }
        });
    }
    // handle GET
    else if ('GET' === req.method) {
        // set timeout
        res.setTimeout(timeout);

        try {
            makeRequest(res, req.url);
        } catch (error) {
            sendJSON(res, error.message);
        }
    }
    // handle POST
    else if ('POST' === req.method) {
        var body = '?';
        req.on('data', function (data) {
            body += data;

            // 1mb really?
            if (body.length > 1e6) {
                req.connection.destroy();
            }
        });
        req.on('end', function () {
            // set timeout
            res.setTimeout(timeout);

            try {
                makeRequest(res, body);
            } catch (error) {
                sendJSON(res, error.message);
            }
        });
    }

}).listen(port);

console.log('listening ' + port);