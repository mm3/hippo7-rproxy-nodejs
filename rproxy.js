/*
 * Copyright (c) 2013-2014
 * 
 * Woonsan Ko
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE
 */


/**
 *
 * Reverse Proxy Script using Node.js
 *
 * Usage: `sudo node rproxy.js` will open 80 port.
 *        `node rproxy.js 8888` will open 8888 port.
 *        `node rproxy.js 8888 8443` will open 8888 port and 8443 ssl port.
 *
 */


/*============================================================*/
/* Reverse Proxy Server Default Options Configuration         */
/*------------------------------------------------------------*/

var defaultOptions = {
  xfwd: true, // add X-Forwarded-* headers
};

// SSL Key file paths; change those paths if you have those in other paths.
var ssl_private_key_path = './priv.pem';
var ssl_certificate_path = './cert.pem';

/*------------------------------------------------------------*/
/* URL Path Mappings Configuration for Reverse Proxy Targets  */
/*------------------------------------------------------------*/
// You can add edit mappings below!

var mappings = [
  {
    host: '*',
    pathregex: /^\/cms(\/|$)/,
    route: {
      target: 'http://127.0.0.1:8080'
    }
  },
  {
    host: '*',
    pathregex: /^\/site(\/|$)/,
    route: {
      target: 'http://127.0.0.1:8080'
    }
  },
  {
    host: '*',
    pathregex: /^/,
    pathreplace: '/site',
    route: {
      target: 'http://127.0.0.1:8080'
    }
  },
];

/*------------------------------------------------------------*/
/* End of Configuration                                       */
/*============================================================*/


// Normally you don't need to look into the detail below
// in most cases unless you want to debug. :-)

var colors = require('colors');

colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red'
});

/**************************************************************/
/* Internal Server Handling Code from here                    */
/*------------------------------------------------------------*/

// find out the port number command line argument
var port = 80;
if (process.argv[2]) {
  port = parseInt(process.argv[2]);
}

// build up the ssl options
var sslOptions = {};
var fs = require('fs');
if (fs.existsSync(ssl_private_key_path)) {
  sslOptions.key = fs.readFileSync(ssl_private_key_path, 'utf8');
} else {
  console.log(('SSL Disabled. SSL private key file does not exist: ' + ssl_private_key_path).warn);
}
if (fs.existsSync(ssl_certificate_path)) {
  sslOptions.cert = fs.readFileSync(ssl_certificate_path, 'utf8');
} else {
  console.log(('SSL Disabled. SSL certificate does not exist: ' + ssl_certificate_path).warn);
}

// let's start building proxy server from here

var http = require('http'),
    httpProxy = require('http-proxy');

//
// function to find a mapping by request path
//
var findMapping = function(req) {
  var host = req.headers['host'];
  for (var i in mappings) {
    var um = mappings[i];
    if (um.host && um.host != '*' && um.host != host) {
      continue;
    }
    if (um.pathregex && req.url.match(um.pathregex)) {
      return um;
    }
  }
  return null;
};

//
// Create a proxy server with custom application logic
//
var proxyServer = httpProxy.createProxyServer(defaultOptions);

//
// proxy handler
//
var proxyHandler = function(req, res) {
  var mapping = findMapping(req);
  if (!mapping) {
    res.writeHead(404);
    res.end();
    console.log('WARN'.warn, 'Mapping not found for '.info, req.url.data);
  } else {
    var oldReqUrl = req.url;
    if (mapping.pathreplace) {
      req.url = oldReqUrl.replace(mapping.pathregex, mapping.pathreplace);
    }
    console.log('INFO'.info, oldReqUrl.data, '->'.verbose, ('' + mapping.route.target + req.url).data);
    proxyServer.web(req, res, mapping.route);
  }
};
 
//
// Create your custom server and just call `proxy.web()` to proxy 
// a web request to the target passed in the options
// also you can use `proxy.ws()` to proxy a websockets request
//
http.createServer(proxyHandler).listen(port);
console.log('');
console.log(('Reverse Proxy Server started at port ' + port + ' ...').info);

// start another server at ssl port if configured
if (sslOptions.key && sslOptions.cert) {
  var sslPort = 443;
  if (process.argv[3]) {
    sslPort = parseInt(process.argv[3]);
  }
  // Create the HTTPS proxy server in front of an HTTP server
  httpProxy.createServer({
    target: {
      host: 'localhost',
      port: port
    },
    ssl: {
      key: sslOptions.key,
      cert: sslOptions.cert
    },
    xfwd: true
  }).listen(sslPort);
  console.log(('Reverse Proxy Server started at SSL port ' + sslPort + ' ...').info);
}

// print out the route mapping information
console.log('');
console.log('Route mappings are as follows:'.info);
console.log('***********************************************************'.info);
console.log(mappings);
console.log('***********************************************************'.info);
console.log('');
