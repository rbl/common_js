/**
 * Dependencies
 */ 
var Net = require("net");
var Util = require("util");
var Events = require("events");

var L = require("log");
var PK = require("pk");
var ByteDeque = require("byteDeque");

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
function Queue(stream)
{
  Events.EventEmitter.call(this);

  // this.outgoingQueue = [];
  // this.incomingQueue = [];
  // this.incomingPartial = ""; 
  this.deque = ByteDeque.create();
  this.stream = stream;
  
  this.channelTemp = Buffer(4);
  this.incomingBuffer = Buffer(1024); // Start with a 1k buffer, which sounds reasonableish
  this.setParseStateGround();
  
  var self = this;
  stream.on("connect",  function() {self.streamConnect()});
  stream.on("data",     function(data) {self.streamData(data)});
  stream.on("end",      function() {self.streamEnd()});
  stream.on("timeout",  function() {self.streamTimeout()});
  stream.on("drain",    function() {self.streamDrain()});
  stream.on("error",    function(err) {self.streamError(err)});
  stream.on("close",    function(hadError) {self.streamClose(hadError)});
    
  // This makes it so we gets strings in the "data" event
  stream.setEncoding("utf8");  
  L.logi("Queue() constructor")
  L.logi("writable = ",this.stream.writable)
}

Util.inherits(Queue, Events.EventEmitter);

module.exports.create = function(stream)
{
  return new Queue(stream);
}


/**
 * Handler for stream "connect" event.
 *
 * @type void
 */
Queue.prototype.streamConnect = function()
{
  L.logi("streamConnect in Queue ...");
  L.logi("writable = ",this.stream.writable)
}

/**
 * Handler for the "data" event. Emits an event for the appropriate channel. Parses
 * JSON messages on channel 0.
 *
 * @param {Buffer} data - The binary data received from the stream.
 * @type void
 */
Queue.prototype.streamData = function(data)
{
  L.logi("streamData",data);
  
  // Add it to the deque
  this.deque.writeBuffer(data);
  
  // If we have enough data, dispatch to the next parsing function
  while (this.deque.length() >= this.amtRequired)
  {
    this.nextParseFunction();
  }
  // // Add this on to whatever we had already
  // this.incomingPartial = this.incomingPartial + data;
  // 
  // // Decide if the last element is going to be parsable or not
  // var lastChar = this.incomingPartial.charAt(this.incomingPartial.length-1);
  // 
  // // Now split it up for parsing
  // var toParse = this.incomingPartial.split("\n");
  // this.incomingPartial = "";
  // 
  // for(var i=0; i<toParse.length; i++)
  // {
  //   if ((i === toParse.length - 1) && (lastChar !== "\n"))
  //   {
  //     // The last one is not a complete thing, so we're out
  //     this.incomingPartial = toParse[i];
  //     break;
  //   }
  //   
  //   if (toParse[i].length == 0) continue;
  //       
  //   try 
  //   {
  //     var msg = JSON.parse(toParse[i]);
  // 
  //     // Allow a preDispatchHook to pre-process or otherwise veto the dispatching
  //     if (this.preDispatchHook)
  //     {
  //       if (!this.preDispatchHook(msg))
  //       {
  //         L.debugi("Pre-dispatch hook returned false, skipping dispatch");
  //         continue;
  //       }
  //     }
  //     
  //     L.infoi("Dispatching message",msg);
  //     this.emit("message", msg);
  //   }
  //   catch(err)
  //   {
  //     L.warni("Error during message dispatch",err);
  //     if (err.stack)
  //     {
  //       L.warni(err.stack);
  //     }
  //     this.emit("messageException",err);
  //   }
  // }  
}

/**
 * Handler for the "drain" event for when the stream is empty. We don't do
 * anything particularly interesting with this right now. If we had buffered
 * data we would want to start writing it at this point.
 *
 * @type void
 */
Queue.prototype.streamDrain = function()
{
  L.debugi("streamDrain");
  
}

/**
 * Handler for the "end" event of the stream.
 *
 * @type void
 */
Queue.prototype.streamEnd = function()
{
  L.debugi("streamEnd");
  
}

/**
 * Handler for the timeout event.
 *
 * @type void
 */
Queue.prototype.streamTimeout = function()
{
  L.debugi("streamTimeout");
  
}

/**
 * Handler for the "error" event on the stream.
 *
 * @param {Exception} exception - The exception which occurred related to the stream
 * @type void
 */
Queue.prototype.streamError = function(exception)
{
  if (exception.stack)
  {
    L.error("Error on the stream");
    L.errori(exception.stack);
  }
  else
  {
    L.errori("Error on the stream:",exception)
  }
}

/**
 * Handler for the close event.
 *
 * @param {bool} hadError - indicates if the stream is closed because of an error
 * @type void
 */
Queue.prototype.streamClose = function(hadError)
{
  // Drop the stream and try to restart the message queue
  L.log("stream closed, hadError",hadError,". Reconnecting in 10 seconds");
  this.stream = null;
  // Rebroadcast this event
  this.emit("close",hadError);
}


/**
 * External interface used to send a message on the JSON message channel. The message
 * probably needs to have a "type" attribute for the other side to care much about it.
 *
 * @param {Object} msg - The message to send
 * @type void
 */
Queue.prototype.sendMessage = function(msg)
{
  PK.writeUInt32(0,this.channelTemp);
  this.stream.write(this.channelTemp);

  // Making the new buffer object all the time isn't awesome, but hopefully it ain't horrid
  out = new Buffer(JSON.stringify(msg));
  PK.writeUInt32(out.length, this.channelTemp);
  this.stream.write(this.channelTemp);
  
  this.stream.write(out);
}

/**
 * Register a collection of handlers to specific events.
 *
 * @param {Object} handlers - map that includes handler functions for named message types
 * @type void
 */
Queue.prototype.registerHandlers = function(handlers)
{
  var self = this;
  for (key in handlers) 
  {
    var handler = handlers[key];
    (function(self, key, handler) {
      L.logi("Registering",key,"to handler",handler);
      self.on("message", function(msg) { if (msg.type===key) handler.handle(self, msg); } );
    })(self, key,handler);
  }
}

Queue.prototype.setParseStateGround = function()
{
  // payload length (uint32)
  // Channel (uint32)
  this.amtRequired = 8;

  this.nextParseFunction = this.parseChannel;
} 

Queue.prototype.parseChannel = function()
{
  // Payload length first
  var r = this.deque.readBuffer(channelTemp);
  if (r!=4)
  {
    throw new Error("Failed to read 4 bytes for PDU payload length");
  }
  this.amtRequired = PK.readUInt32(channelTemp);
  
  // First 4 bytes are the channel
  r = this.deque.readBuffer(channelTemp);
  if (r!=4)
  {
    throw new Error("Failed to read 4 bytes for PDU payload length");
  }
  this.incomingChannel = PK.readUInt32(channelTemp);
  
  this.nextParseFunction = this.parsePayload;
}

Queue.prototype.parsePayload = function()
{
  if (this.incomingBuffer.length < this.amtRequired)
  {
    this.incomingBuffer = new Buffer(this.amtRequired);
  }
  
  var r = this.deque.read(this.incomingBuffer, 0, this.amtRequired);
  if (r!=this.amtRequired)
  {
    throw new Error("Umm, I was promised "+this.amtRequired+" but only managed to read "+r+". Fail.");
  }
  
  if (!this.incomingChannel)
  {
    // Treat it as a message
    this.dispatchMessage();
  }
  else
  {
    // Some other data stream
    this.dispatchData();
  }
  
  this.setParseStateGround();
}

Queue.prototype.dispatchMessage = function()
{
  L.logi("Dispatching message");
  try 
  {
    data = this.incomingBuffer.slice(0,this.amtRequired);
    var msg = JSON.parse(this.incomingBuffer);

    // Allow a preDispatchHook to pre-process or otherwise veto the dispatching
    if (this.preDispatchHook)
    {
      if (!this.preDispatchHook(msg))
      {
        L.debugi("Pre-dispatch hook returned false, skipping dispatch");
        continue;
      }
    }
    
    L.infoi("Dispatching message",msg);
    this.emit("message", msg);
  }
  catch(err)
  {
    L.warni("Error during message dispatch",err);
    if (err.stack)
    {
      L.warni(err.stack);
    }
    this.emit("messageException",err);
  }
  
}

Queue.prototype.dispatchData = function()
{
  L.logi("Dispatching data, channel=",this.incomingChannel,"size=",this.amtRequired);
}
