var URL = require("url");
var Http = require("http");
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

    // Todo, in the future cache these. For now, make them all new
    var client = Http.createClient(this.url.port, this.url.hostname);

    var headers = {
        'host': this.url.hostname
    };
    
    if (this.token) {
        headers['Authorization'] = "OAuth2 "+this.token;
    }

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

        path += QueryString.stringify(body);
        this.body = null;
    }

    var bodyContent;
    if (this.body) {
        if (this.asJSON) {
            Logger.debug('Writing body, encoding as JSON');
            bodyContent = JSON.stringify(this.body);
            headers["Content-Type"] = "application/json";
        } else {
            if (typeof this.body === "object") {
                Logger.debug("Writing body, encoding using query string");
                bodyContent = QueryString.encode(body);
                headers["Content-Type"] = "application/x-www-form-urlencoded";
            } else {
                Logger.debug('Writing body, no additional encoding');
                bodyContent = this.body;
                headers["Content-Type"] = this.contentType || "text/plain";
            }
        }
    }
    
    if (bodyContent) {
        headers["content-length"] = bodyContent.length;
    }
    
    var request = client.request(this.method, path, headers);
    if (bodyContent) {
        request.write(bodyContent);
    }
    
    var responseBuffer = "";
    request.end();

    var self = this;
    request.on('response', function(response) {
        // if (response.statusCode >= 300)
        // {
        //   // Failed!
        //   if (callback) return callback(new Error("Got server response "+response.statusCode), null);
        // }
        //
        Logger.log('Response code is ', response.statusCode);
        response.setEncoding('utf8');
        response.on('data', function(chunk) {
            responseBuffer += chunk;
        });

        response.on('end', function() {
            // Hand the entire response to the callback
            Logger.log('Got end event');
            if (self.callback) {
                if (responseBuffer && responseBuffer.length && self.asJSON) {
                    //Logger.warni("Response be", responseBuffer);
                    return self.callback(null, response, JSON.parse(responseBuffer));
                } else {
                    return self.callback(null, response, responseBuffer);
                }
            }
        })
    });

    client.on('error', function(error) {
        if (self.callback) {
            return self.callback(error);
        }
        Logger.errori("HttpClient on 'error'", error);
    });
}


function parseStandardArguments(list) {
    Logger.infoi("Parsing standard arguments",list);
    
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


function methodRequest(method, json) {
    return function(standardArguments) {
        args = parseStandardArguments(arguments);
        args.method = method;
        args.asJSON = json;
        
        exports.make(args);
    }
}

exports.get = methodRequest("GET");
exports.delete = methodRequest("DELETE");
exports.put = methodRequest("PUT");
exports.post = methodRequest("POST");

exports.getJSON = methodRequest("GET",true);
exports.deleteJSON = methodRequest("DELETE",true);
exports.putJSON = methodRequest("PUT",true);
exports.postJSON = methodRequest("POST",true);