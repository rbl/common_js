var URL = require("url");
var Http = require("http");
var Https = require("https");
var Sys = require("sys");
var Logger = require("logger");
var JSON = require("json");
var QueryString = require("querystring")

var WebRequest = function WebRequest(opts)
{
    if (!opts) throw new Error("WebRequest requires opts hash as it's only argument");
    if (!opts.url) throw new Error("WebRequest requires a url option");

    this.method = opts.method || "GET";
    this.asJSON = opts.asJSON;

    var url;
    if (typeof opts.url === 'string') {
        url = URL.parse(opts.url);
    } else {
        url = opts.url;
        if (!url.protocol) url.protocol = "http:";
        if (!url.hostname && url.host) url.hostname = url.host;
    }
    this.url = url;
    
    this.body = opts.body;
    this.callback = opts.callback;
    this.token = opts.token;    
}

exports.make = function make(opts) {
    (new WebRequest(opts)).start();
}

WebRequest.prototype.start = function() {
    if (!this.url.pathname) this.url.pathname = '/';
    if (!this.url.port) this.url.port = 80;
    
    Logger.debugi("WebRequest.start()", this.method, this.url.host, this.url.port, this.url.pathname, this.asJSON)

    var reqOptions = {};
    
    reqOptions.host = this.url.host;
    reqOptions.port = this.url.port;
    reqOptions.method = this.method;
    
    ///////////
    // Some headers. Looks like node adds the Host header for us just fine
    reqOptions.headers = {};
    if (this.token) {
        //Logger.errori("Adding token",this.token);
        reqOptions.headers['Authorization'] = "OAuth2 "+this.token;
    } else {
        //Logger.errori("---- NO OAUTH TOKEN ----");
    }

    ///////////
    // Setup the path
    var path = this.url.pathname;
    if (this.body && (this.method === "GET" || this.method === "DELETE")) {
        // These don't actually allow us to send content, so put this stuff in
        // the url path as query parameters
        if (path.indexOf("?") == -1) {
            // No existing params
            path += "?";
        } else {
            // Something there already
            path += "&";
        }

        path += QueryString.stringify(this.body);
        this.body = null;
    }
    reqOptions.path = path;
    
    //////////////
    // Content for the body
    var bodyContent;
    if (this.body) {
        if (this.asJSON) {
            Logger.debug('Writing body, encoding as JSON');
            bodyContent = JSON.stringify(body);
            reqOptions.headers["Content-Type"] = "application/json";
        } else {
            if (typeof this.body === "object") {
                Logger.debug("Writing body, encoding using query string");
                bodyContent = QueryString.encode(this.body);
                reqOptions.headers["Content-Type"] = "application/x-www-form-urlencoded";
            } else {
                Logger.debug('Writing body, no additional encoding');
                bodyContent = this.body;
                reqOptions.headers["Content-Type"] = this.contentType || "text/plain";
            }
        }
    }
    
    /////////////////////////////
    // All ready to go now ....
    if (bodyContent) {
        reqOptions.headers['Content-Length'] = bodyContent.length;
    }
    

    var request;
    if (this.url.protocol === "https:") {
        Logger.debug("Making a secure connection");
        request = Https.request(reqOptions);
    } else {
        request = Http.request(reqOptions);
    }
    
    // var request = client.request(this.method, path, headers);
    if (bodyContent) {
        Logger.debug("Writing",bodyContent.length,"bytes of body content");
        request.write(bodyContent);
    }
    request.end();
    
    var responseBuffer = "";

    var self = this;
    request.on('response', function(response) {
        // if (response.statusCode >= 300)
        // {
        //   // Failed!
        //   if (callback) return callback(new Error("Got server response "+response.statusCode), null);
        // }
        //
        Logger.debug('Response code is ', response.statusCode);
        // if (response.statusCode != 200) {
        //     try {
        //         self.callback({code:response.statusCode});
        //     } catch (err) {
        //         Logger.logErrorObj("Sending status code", err);
        //         return;
        //     }
        // }
        
        response.setEncoding('utf8');
        response.on('data', function(chunk) {
            responseBuffer += chunk;
        });

        response.on('end', function() {
            // Hand the entire response to the callback
            //Logger.log('Got end event');
            if (self.callback) {
                if (responseBuffer && responseBuffer.length && self.asJSON) {
                    //Logger.warni("Response be", responseBuffer);
                    var buff = null;
                    try {
                        buff = JSON.parse(responseBuffer);
                    } catch (e) {
                        // ignore it ...
                        Logger.debugi("Supposedly JSON response failed to parse",e);
                    }
                    return self.callback(null, response, buff);
                } else {
                    return self.callback(null, response, responseBuffer);
                }
            }
        })
    });

    request.on('error', function(error) {
        if (callback) {
            return callback(error);
        }
        Logger.errori("WebRequest on 'error'", error);
    });
}


function parseStandardArguments(list) {
    //Logger.infoi("Parsing standard arguments",list);
    
    var args = {};
    args.url = list[0];
    
    if ((typeof list[1]) === 'function') {
        args.callback = list[1];
        return args;
    }
    args.body = list[1];
    
    if ((typeof list[2]) === 'function') {
        args.callback = list[2];
        return args;
    }
    args.token = list[2];
    
    args.callback = list[3];
    return args;
}


exports.methodRequest = function methodRequest(method, json) {
    return function(standardArguments) {
        args = parseStandardArguments(arguments);
        args.method = method;
        args.asJSON = json;
        
        exports.make(args);
    }
}

exports.get = exports.methodRequest("GET");
exports.delete = exports.methodRequest("DELETE");
exports.put = exports.methodRequest("PUT");
exports.post = exports.methodRequest("POST");

exports.getJSON = exports.methodRequest("GET",true);
exports.deleteJSON = exports.methodRequest("DELETE",true);
exports.putJSON = exports.methodRequest("PUT",true);
exports.postJSON = exports.methodRequest("POST",true);
