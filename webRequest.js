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
}

WebRequest.prototype.start = function(body, callback) {
    if (!this.url.pathname) this.url.pathname = '/';
    if (!this.url.port) this.url.port = 80;
    var asJSON = this.asJSON;

    Logger.debugi("WebRequest.start()", this.method, this.url.host, this.url.port, this.url.pathname)

    // Todo, in the future cache these. For now, make them all new
    var client = Http.createClient(this.url.port, this.url.hostname);

    var headers = {
        'host': this.url.hostname
    };

    var path = this.url.pathname;
    if (body && (this.method === "GET" || this.method == "DELETE")) {
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
        body = null;
    }

    var bodyContent;
    if (body) {
        if (asJSON) {
            Logger.debug('Writing body, encoding as JSON');
            bodyContent = JSON.stringify(body);
            headers["Content-Type"] = "application/json";
        } else {
            if (typeof body === "object") {
                Logger.debug("Writing body, encoding using query string");
                bodyContent = QueryString.encode(body);
                headers["Content-Type"] = "application/x-www-form-urlencoded";
            } else {
                Logger.debug('Writing body, no additional encoding');
                bodyContent = body;
                headers["Content-Type"] = "text/plain";
            }
        }
    }
    
    var request = client.request(this.method, path, headers);
    if (bodyContent) {
        request.write(bodyContent);
    }
    
    var responseBuffer = "";
    request.end();

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

        response.on('end',
        function() {
            // Hand the entire response to the callback
            Logger.log('Got end event');
            if (callback) {
                if (responseBuffer && responseBuffer.length && asJSON) {
                    Logger.logi("Response be", responseBuffer);
                    return callback(null, response, JSON.parse(responseBuffer));
                } else {
                    return callback(null, response, responseBuffer);
                }
            }
        })
    });

    client.on('error', function(error) {
        if (callback) {
            return callback(error);
        }
        Logger.errori("HttpClient on 'error'", error);
    });
}

exports.get = function(url, doc, callback) {
    if ((typeof doc) == "function") {
        callback = doc;
        doc = null;
    }

    var opts = {
        url: url,
        method: "GET"
    };
    var req = new WebRequest(opts);

    return req.start(doc, callback);
}


exports.delete = function(url, doc, callback) {
    if ((typeof doc) == "function") {
        callback = doc;
        doc = null;
    }

    var opts = {
        url: url,
        method: "DELETE"
    };
    var req = new WebRequest(opts);

    return req.start(doc, callback);
}

exports.put = function(url, doc, callback) {
    var opts = {
        url: url,
        method: "PUT"
    };
    var req = new WebRequest(opts);

    return req.start(doc, callback);
}

exports.post = function(url, doc, callback) {
    var opts = {
        url: url,
        method: "POST"
    };
    var req = new WebRequest(opts);


    return req.start(doc, callback);
}

// JSON versions
exports.getJSON = function(url, doc, callback) {
    if ((typeof doc) == "function") {
        callback = doc;
        doc = null;
    }

    var opts = {
        url: url,
        method: "GET",
        asJSON: true
    };
    var req = new WebRequest(opts);

    return req.start(doc, callback);
}


exports.deleteJSON = function(url, doc, callback) {
    if ((typeof doc) == "function") {
        callback = doc;
        doc = null;
    }

    var opts = {
        url: url,
        method: "DELETE",
        asJSON: true
    };
    var req = new WebRequest(opts);

    return req.start(doc, callback);
}

exports.putJSON = function(url, doc, callback) {
    var opts = {
        url: url,
        method: "PUT",
        asJSON: true
    };
    var req = new WebRequest(opts);

    return req.start(doc, callback);
}

exports.postJSON = function(url, doc, callback) {
    var opts = {
        url: url,
        method: "POST",
        asJSON: true
    };
    var req = new WebRequest(opts);


    return req.start(doc, callback);
}

// Standard initializer stuff
exports.init = WebRequest;

exports.create = function(opts) {
    return new WebRequest(opts);
}

exports.extend = function(subclass) {
    subclass.prototype = WebRequest.prototype;
}