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
    
    var self = this;
    
    if (!self.url.pathname) self.url.pathname = '/';
    if (!self.url.port) self.url.port = 80;
    
    Logger.debugi("WebRequest.start()", self.method, self.url.host, self.url.port, self.url.pathname, self.asJSON)

    var reqOptions = {};
    
    reqOptions.host = self.url.hostname;
    reqOptions.port = self.url.port;
    reqOptions.method = self.method;
    
    ///////////
    // Some headers. Looks like node adds the Host header for us just fine
    reqOptions.headers = {};
    if (self.token) {
        //Logger.errori("Adding token",self.token);
        reqOptions.headers['Authorization'] = "OAuth2 "+self.token;
    } else {
        //Logger.errori("---- NO OAUTH TOKEN ----");
    }

    ///////////
    // Setup the path
    var path = self.url.pathname;
    if (self.body && (self.method === "GET" || self.method === "DELETE")) {
        // These don't actually allow us to send content, so put this stuff in
        // the url path as query parameters
        if (path.indexOf("?") == -1) {
            // No existing params
            path += "?";
        } else {
            // Something there already
            path += "&";
        }

        path += QueryString.stringify(self.body);
        self.body = null;
    }
    reqOptions.path = path;
    
    //////////////
    // Content for the body
    var bodyContent;
    if (self.body) {
        if (self.asJSON) {
            Logger.debug('Writing body, encoding as JSON');
            bodyContent = JSON.stringify(self.body);
            reqOptions.headers["Content-Type"] = "application/json";
        } else {
            if (typeof self.body === "object") {
                Logger.debug("Writing body, encoding using query string");
                bodyContent = QueryString.encode(self.body);
                reqOptions.headers["Content-Type"] = "application/x-www-form-urlencoded";
            } else {
                Logger.debug('Writing body, no additional encoding');
                bodyContent = self.body;
                reqOptions.headers["Content-Type"] = self.contentType || "text/plain";
            }
        }
    }
    
    /////////////////////////////
    // All ready to go now ....
    if (bodyContent) {
        reqOptions.headers['Content-Length'] = bodyContent.length;
    }
    

    var request;
    if (self.url.protocol === "https:") {
        Logger.debug("Making a secure connection");
        request = Https.request(reqOptions);
    } else {
        request = Http.request(reqOptions);
    }
    
    // var request = client.request(self.method, path, headers);
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
        if (self.callback) {
            return self.callback(error);
        }
        Logger.errori("WebRequest on 'error'", error);
    });
}


// Standard arguments are
//   url, body, token, callback

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



///////////////////////////////////////////////////////////////////////////////
/**
 * Extracts a standard error object from the results of a JSON request. Examines
 * all 3 response variables and returns a consolidate single object if something
 * bad happened or returns null if the request appears to have completed ok
 * with a 200 and no error key in the returned object.
 *
 * The idea is that this let's you write code somewhat like this:
 * 
 *     WebRequest.getJSON(..., function(e,r,d) {
 *         if (err = Logger.logErrorObj(WebRequest.extractJSONError(e,r,d))) next(err);
 *    
 *         // else, success do good things ...
 *     }
 * 
 * @param {Object} err - error object
 * @param {Response} response - web response object (has error code in it)
 * @param {Object} data - the data object which might have a 'error' key
 * @returns either the original error object, and error from the data object, an error
 *          object representing a non-200 error code, or null if none of the previous
 * @type Object
 */
exports.extractJSONError = function(err, response, data) {
    if (err) return err;
    
    if (data && data.error) return data;
    
    if (response && response.code !== 200) return {error:"HTTP_"+response.code, errorDescription:response.message};
    
    return null;
}
