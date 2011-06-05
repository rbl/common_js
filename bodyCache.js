/**
 * A connect middleware to cache the body being sent by the client while
 * the server is off doing things like fetching session data.
 * 
 * This probably needs to be inlined for only the requests you care about
 * the raw body for and before any session stuff.  There's some obvious
 * overlap with the bodyParser included with connect, so someday maybe they could
 * get combined at some point.
 */

var Logger = require("logger");
var Events = require("events");
var Util = require("util");

function CachedBody(req, opts) {
    this.opts = opts;
    this.data = '';
    this.completed = false;
    
    var self = this;
    req.on('error', function(err) {
        if (self.completed) return;
        self.error = err;
        self.end();
    });
    
    req.on('aborted', function() {
        if (self.completed) return;
        self.error = "Aborted";
        self.end();
    });
    
    req.on('data', function(buffer) {
        if (self.completed) return;
        self.write(buffer);
    });
    
    req.on('end', function() {
        if (self.completed) return;
        self.end();
    });
    
    // We need to get the data out of buffers and into a js string
    req.setEncoding("utf-8");
}
Util.inherits(CachedBody, Events.EventEmitter);

CachedBody.prototype.write = function write(data) {
    this.data += data;
    
    if (this.data.length > this.opts.expectedLength) {
        // Error!
        this.error = "Content-length exceeded";
        this.end();
    }
}

CachedBody.prototype.end = function end() {
    if (this.completed) return;
    this.completed = true;
    
    Logger.infoi("A cached body of",this.data.length,"bytes has become completed");
    this.emit('end', this.error, this.data);
}

CachedBody.prototype.read = function read(callback) {
    var self = this;
    Logger.log("Reading data");

    // If done, return immediately
    if (this.completed) {
        Logger.log("Already completed so calling callback right away");
        return callback(self.error, self.data);
    }
    
    // Need to wait for the end
    this.on('end', function() {
        Logger.log("GOt end event");
        return callback(self.error, self.data);
    });
}

///////////////////////////////////////////////////////////////////////////////
/**
 * The exported function which returns a configured middleware
 */

module.exports = function(opts) {
    
    Logger.infoi("Allocating a bodyCache with options",opts);
    
    opts || (opts = {});
    opts.maxSize || (opts.maxSize = 2 * 1024 * 1024);
    
    return function(req, res, next) {
        var dataLength = -1;
        if (req.headers['content-length']) {
            dataLength = parseInt(req.headers['content-length'],10) || 0;
        }

        if (dataLength > opts.maxSize) {
            Logger.warni("Client tried to upload",dataLength,"which is larger than max size",opts.maxSize);
            return sendError(413, req, res, "Exceeds max size");
        }
        if (dataLength == 0) {
            Logger.warni("Client did not specify the content length");
            return sendError(400, req, res, "Must have at least 1 byte of content");
        }

        Logger.info("Expecting data of length",dataLength);
        opts.expectedLength = dataLength;
        
        req.cachedBody = new CachedBody(req, opts);
        
        // That will be busy caching the stuff that comes in, but the
        // next middleware might want to start up some processes
        next();
    };
}