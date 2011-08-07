/**
 * Dependencies
 */
var Net = require("net");
var Util = require("util");
var Events = require("events");

var Logger = require("logger");
var PK = require("pk");
var ByteDeque = require("byteDeque");

// The next value for a data channel other than the message channel
var nextChannel = 1;

/**
 * Creates a Queue object with the given stream. TLS needs to be handled prior to the
 * stream being given to us because it varies for clients and servers. This class is
 * meant to be reusable by both clients and servers.
 *
 * @param {Stream} stream - The already connected and configured stream object
 * @returns A new Queue object
 * @type Queue
 * @constructor
 */
function Queue(stream) {
    Events.EventEmitter.call(this);

    // this.outgoingQueue = [];
    // this.incomingQueue = [];
    // this.incomingPartial = "";
    this.deque = ByteDeque.create();
    this.stream = stream;

    this.channelTemp = Buffer(4);
    this.incomingBuffer = Buffer(1024);
    // Start with a 1k buffer, which sounds reasonableish
    this.setParseStateGround();
    
    // Before authentication is complete we have to make sure messages are processing
    // serially. After that we do them asynch. If there is a preDispatchHook we will
    // pause parsing while it does it's work and then unpause it after it's done.
    this.parsingPaused = false;

    var self = this;
    stream.on("connect", function() { self.streamConnect(); });
    stream.on("data", function(data) { self.streamData(data); });
    stream.on("end", function() { self.streamEnd(); });
    stream.on("timeout", function() { self.streamTimeout(); });
    stream.on("drain", function() { self.streamDrain(); });
    stream.on("error", function(err) { self.streamError(err); });
    stream.on("close", function(hadError) { self.streamClose(hadError); });

    // This makes it so we gets strings in the "data" event
    //stream.setEncoding("utf8");
    Logger.logi("Queue() constructor")
    Logger.logi("writable = ", this.stream.writable)
}

Util.inherits(Queue, Events.EventEmitter);

module.exports.create = function(stream) {
    return new Queue(stream);
}


/**
 * Handler for stream "connect" event.
 *
 * @type void
 */
Queue.prototype.streamConnect = function() {
    Logger.logi("streamConnect in Queue ...");
    Logger.logi("writable = ", this.stream.writable)
}

/**
 * Handler for the "data" event. Emits an event for the appropriate channel. Parses
 * JSON messages on channel 0.
 *
 * @param {Buffer} data - The binary data received from the stream.
 * @type void
 */
Queue.prototype.streamData = function(data) {
    //Logger.logi("streamData", data);

    // Add it to the deque
    if (data) {
        this.deque.writeBuffer(data);
    }

    //Logger.logi("this.deque.getLength()=", this.deque.getLength())
    // If we have enough data, dispatch to the next parsing function
    while (this.deque.getLength() >= this.amtRequired && !this.parsingPaused) {
        this.nextParseFunction();
    }
    
    if (this.parsingPaused) {
        Logger.debug("Stopped parsing because it's paused");
    }
}

/**
 * Handler for the "drain" event for when the stream is empty. We don't do
 * anything particularly interesting with this right now. If we had buffered
 * data we would want to start writing it at this point.
 *
 * @type void
 */
Queue.prototype.streamDrain = function() {
    //Logger.debugi("streamDrain");
    this.emit("drain");
}

/**
 * Handler for the "end" event of the stream.
 *
 * @type void
 */
Queue.prototype.streamEnd = function() {
    Logger.debugi("streamEnd");

}

/**
 * Handler for the timeout event.
 *
 * @type void
 */
Queue.prototype.streamTimeout = function() {
    Logger.debugi("streamTimeout");

}

/**
 * Handler for the "error" event on the stream.
 *
 * @param {Exception} exception - The exception which occurred related to the stream
 * @type void
 */
Queue.prototype.streamError = function(exception) {
    if (exception.stack) {
        Logger.error("Error on the stream");
        Logger.errori(exception.stack);
    } else {
        Logger.errori("Error on the stream:", exception)
    }
}

/**
 * Handler for the close event.
 *
 * @param {bool} hadError - indicates if the stream is closed because of an error
 * @type void
 */
Queue.prototype.streamClose = function(hadError) {
    // Drop the stream and try to restart the message queue
    Logger.log("stream closed, hadError", hadError);
    this.stream = null;
    // Rebroadcast this event
    this.emit("close", hadError);
}


/**
 * External interface used to send a message on the JSON message channel. The message
 * probably needs to have a "type" attribute for the other side to care much about it.
 *
 * @param {Object} msg - The message to send
 * @type void
 */
Queue.prototype.sendMessage = function(msg) {
    // Making the new buffer object all the time isn't awesome, but hopefully it ain't horrid
    out = new Buffer(JSON.stringify(msg));
    PK.writeUInt32(out.length + 4, this.channelTemp);
    this.streamWrite(this.channelTemp);

    // First 4 bytes are the channel
    PK.writeUInt32(0, this.channelTemp);
    this.streamWrite(this.channelTemp);

    this.streamWrite(out);
}

/**
 * Gets a new channel number. Channels are not really "open" or "closed". Things
 * that want to send some sort of data need to just get a new channel and then
 * implement their own close message outside of the channel stream. Since channel
 * ids are ints there really shouldn't be an overflow issue.
 * 
 * In the future we might do a generic channel close mechanism if we really start
 * having a lot of streaming going back and forth and what not.
 * 
 * The other important thing to note is that channels are only safe if they are
 * uni-directional. While there is no technical difference of having transmitters
 * or receivers define the channel number and then communicate it to their peer, it is
 * important that all use of a single queue follows a single convention.
 * 
 * Therefore, by convention, I'm declaring that transmitters should be the ones to
 * define channel numbers.
 *
 * @returns A new channel number
 * @type int
 */
Queue.prototype.getNewTransmitChannel = function() {
    return nextChannel++;
}

/**
 * Send data on a given channel. The data can be a string or preferably a
 * full Buffer object. You presumably could send data on channel 0 - but probably
 * shouldn't. That's reserved for JSON messages. To get a new channel to 
 * send on, use getNewTransmitChannel and then communicate this to your peer in some
 * use dependent fashion.
 *
 * @param {int} channel - The channel this data will be sent on
 * @param {String|Buffer} data - The data to send
 * @type void
 */
var maxDataChunkSize = 4096 * 2;
Queue.prototype.sendDataOnChannel = function(data, channel) {
    
    var self = this;
    
    if (typeof channel == 'undefined') {
        Logger.hr();
        Logger.errori("Attempting to send", data.length, "bytes on undefined channel. Boo!");
        Logger.logStack();
    }
    //Logger.debugi("sending", data.length, "bytes of data on channel", channel);

    if (! (data instanceof Buffer)) {
        data = Buffer(data.toString());
    }

    if (data.length > maxDataChunkSize) {
        // Because sending huge chunks requires lots of buffering on the other end and tends
        // to blow up writes in a horrible way, cut this up into smaller chunks
        var done = 0;
        while(done < data.length) {
            //Logger.info("Sending smaller chunk done=",done);
            var toDo = data.length - done;
            if (toDo > maxDataChunkSize) toDo = maxDataChunkSize;
            
            var chunk = data.slice(done, done+toDo);
            self.sendDataOnChannel(chunk, channel);
            done += toDo;
        }
        
    } else {
        // It's just a single chunk
        // The amount of data we be writing, plus the channel identifier
        PK.writeUInt32(data.length + 4, self.channelTemp);
        self.streamWrite(this.channelTemp);

        // First 4 bytes are the channel
        PK.writeUInt32(channel, self.channelTemp);
        self.streamWrite(self.channelTemp);

        // The data itself
        self.streamWrite(data);
    }
}

/**
 * Register a collection of handlers to specific events.  While this seems handy, the
 * downside is there is no way to unregister them. 
 *
 * @param {Object} handlers - map that includes handler functions for named message types
 * @type void
 */
Queue.prototype.registerHandlers = function(handlers) {
    var self = this;
    for (key in handlers) {
        var handler = handlers[key];
        (function(self, key, handler) {
            Logger.logi("Registering", key, "to handler", handler);
            self.on("message", function(msg) {
                if (msg.type === key) handler.handle(self, msg);
            });
        })(self, key, handler);
    }
}



////////////////////////////////////////////////////////////////////////////////////
// Internal / Private things after here ....
Queue.prototype.setParseStateGround = function() {
    // payload length (uint32)
    // Channel (uint32)
    this.amtRequired = 8;

    this.nextParseFunction = this.parseChannel;
}

Queue.prototype.parseChannel = function() {
    // Payload length first
    var r = this.deque.readBuffer(this.channelTemp);
    if (r != 4) {
        throw new Error("Failed to read 4 bytes for PDU payload length");
    }
    this.amtRequired = PK.readUInt32(this.channelTemp);

    if (this.amtRequired < 4) {
        // WTF mate?
        Logger.warni("Got weird payload length", this.amtRequired, ". Reading and trying to continue, but probably will go bad soon.")
        this.deque.readBuffer(this.channelTemp, 0, this.amtRequired);
        this.setParseStateGround();
        return;
    }

    // First 4 bytes are the channel
    r = this.deque.readBuffer(this.channelTemp);
    if (r != 4) {
        throw new Error("Failed to read 4 bytes for PDU payload length");
    }
    this.incomingChannel = PK.readUInt32(this.channelTemp);

    // Reduce the amt required
    this.amtRequired -= 4;
    this.nextParseFunction = this.parsePayload;
}

Queue.prototype.parsePayload = function() {
    if (this.incomingBuffer.length < this.amtRequired) {
        this.incomingBuffer = new Buffer(this.amtRequired);
    }

    var r = this.deque.read(this.incomingBuffer, 0, this.amtRequired);
    if (r != this.amtRequired) {
        throw new Error("Umm, I was promised " + this.amtRequired + " but only managed to read " + r + ". Fail.");
    }

    if (!this.incomingChannel) {
        // Treat it as a message
        this.dispatchMessage();
    } else {
        // Some other data stream
        this.dispatchData();
    }

    this.setParseStateGround();
}

Queue.prototype.dispatchMessage = function() {

    var self = this;
    try {
        data = self.incomingBuffer.slice(0, self.amtRequired);
        var msg = JSON.parse(data);

        // Allow a preDispatchHook to pre-process or otherwise veto the dispatching
        if (self.preDispatchHook) {
            // Don't parse anything else until this message is resolved. We need to give
            // authentication a chance to go to the database
            self.parsingPaused = true;
            
            self.preDispatchHook(msg, function() {
                // Unpause and restart the parsing loop
                Logger.debug("Unpausing parsing (I think...)");
                self.parsingPaused = false;
                self.streamData(null);
            });
        } else {
            self.emit("message", msg);
        }
    } catch(err) {
        Logger.logErrorObj("Error during message dispatch", err);
        // if (err.stack) {
        //     Logger.warni(err.stack);
        // }
        
        // This ALWAYS unpauses messages for safety
        self.parsingPaused = false;
        
        self.emit("messageException", err);
    }
}

Queue.prototype.dispatchData = function() {
    try {
        data = this.incomingBuffer.slice(0, this.amtRequired);
        //Logger.debugi("Dispatching data, channel=", this.incomingChannel, "size=", this.amtRequired);
        this.emit("c" + this.incomingChannel, data);
    } catch(err) {
        Logger.warni("Error during channel", this.incomingChannel, "dispatch", err);
        if (err.stack) {
            Logger.warni(err.stack);
        }
        this.emit("dataException", err);
    }
}


Queue.prototype.streamWrite = function(data) {
    if (!this.stream.write(data)) {
        this.emit("buffering");
    }
}


Queue.prototype.pause = function() {
    this.stream.pause();
    this.parsingPaused = true;
}

Queue.prototype.resume = function() {
    var self = this;
    self.parsingPaused = false;
    self.stream.resume();
    process.nextTick(function() {
        self.streamData();
    });
}
