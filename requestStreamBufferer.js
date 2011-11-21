var EventEmitter = require("events").EventEmitter;
var Util = require("util");

var Logger = require("logger");
var ByteDeque = require("byteDeque");


function InputBuffer(req) {    
    EventEmitter.call(this);
    
    var self = this;
    
    //Logger.infoi("InputBuffer created");
    self.deque = ByteDeque.create();
        
    req.on("data", function(data) {
        
        self.gotData(data);
    });
    
    req.on("end", function() {
        self.ended();
    });
    
    // Start out paused
    self.paused = true;
    req.pause(); // Not that this actually works, but heh
    
    
    self.shovel = new Buffer(10240);
    
    self.haveEnded = false;
    self.emittedEnd = false;
    self.req = req;
}
Util.inherits(InputBuffer, EventEmitter);


InputBuffer.prototype.gotData = function(data) {
    
    var self = this;
    
    //Logger.infoi("InputBuffer got data length=",data ? data.length : "undef");
    
    if (data) {
        self.deque.writeBuffer(data);
    }
    
    if (!self.paused) {
        // Send whatever is in the deque on to the next listener
        var read = self.deque.readBuffer(self.shovel);
        if (read > 0) {
            // Dispatch to my own listeners
            //Logger.infoi("InputBuffer emitting data event");
            self.emit("data", self.shovel.slice(0,read));
            
            // Now, because we might have (i.e. probably did) get paused during that
            // event, we do a tick before the next attempted output
            process.nextTick(function() {
                self.gotData();
            });
        } else if (self.haveEnded && !self.emittedEnd) {
            //Logger.infoi("InputBuffer emitting end event");
            self.emittedEnd = true;
            self.emit("end");
        }
    } else {
        //Logger.info("InputBuffer not emitting anything 'cause I'm paused");
    }
}

InputBuffer.prototype.ended = function() {
    
    var self = this;
    
    //Logger.infoi("InputBuffer ended");
    // Drop this to prevent continuation of a circular reference
    self.req = false;
    
    self.haveEnded = true;
    
    // Loop until out of data
    process.nextTick(function() {
        self.gotData();
    });
}

InputBuffer.prototype.pause = function() {
    
    var self = this;
    
    //Logger.infoi("InputBuffer paused");
    self.paused = true;
    
    // This doesn't always work (which is why we wrote this in the first place), but
    // give it a chance to work ...
    if (self.req) {
        //Logger.info("   also paused the request")
        self.req.pause();
    }
}

InputBuffer.prototype.resume = function() {
    
    var self = this;
    
    //Logger.infoi("InputBuffer resumed, dequeue.length=",self.deque.getLength());
    self.paused = false;
    
    if (self.req) {
        //Logger.info("   also resumed the request")
        self.req.resume();
    }
    
    process.nextTick(function() {
        self.gotData();
    });
}

InputBuffer.prototype.end = function() {

    var self = this;
    
    //Logger.infoi("InputBuffer end() called");
    if (self.req) {
        self.req.end();
    }
}


////////////
// The middleware 
module.exports = function(options) {
    
    options = options || {};
    
    
    return function(req, res, next) {
        
        req.bufferedInput = new InputBuffer(req);
        next();
    }
    
}