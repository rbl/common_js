/**
 * Dependencies
 */ 
var Net = require("net");
var Util = require("util");
var Events = require("events");

var L = require("log");
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
  //stream.setEncoding("utf8");  
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
  
  L.logi("this.deque.getLength()=",this.deque.getLength())
  // If we have enough data, dispatch to the next parsing function
  while (this.deque.getLength() >= this.amtRequired)
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
  L.log("stream closed, hadError",hadError);
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
  // Making the new buffer object all the time isn't awesome, but hopefully it ain't horrid
  out = new Buffer(JSON.stringify(msg));
  PK.writeUInt32(out.length + 4, this.channelTemp);
  this.stream.write(this.channelTemp);

  // First 4 bytes are the channel
  PK.writeUInt32(0,this.channelTemp);
  this.stream.write(this.channelTemp);

  this.stream.write(out);
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
 * @returns A new channel number
 * @type int
 */
Queue.prototype.getNewChannel = function()
{
  return nextChannel++;
}

/**
 * Send data on a given channel. The data can be a string or preferably a
 * full Buffer object. You presumably could send data on channel 0 - but probably
 * shouldn't. That's reserved for JSON messages. To get a new channel to 
 * send on, use getNewChannel and then communicate this to your peer in some
 * use dependent fashion.
 *
 * @param {int} channel - The channel this data will be sent on
 * @param {String|Buffer} data - The data to send
 * @type void
 */
Queue.prototype.sendDataOnChannel = function(data, channel)
{
  if (typeof channel == 'undefined')
  {
    L.hr();
    L.errori("Attempting to send",data.length,"bytes on undefined channel. Boo!");
    L.logStack();
  }
  L.logi("sending",data.length,"bytes of data on channel",channel);
  
  if (!(data instanceof Buffer))
  {
    data = Buffer(data.toString());
  }
  
  // The amount of data we be writing, plus the channel identifier  
  PK.writeUInt32(data.length + 4, this.channelTemp);
  this.stream.write(this.channelTemp);

  // First 4 bytes are the channel
  PK.writeUInt32(channel,this.channelTemp);
  L.logi("channelTemp is",this.channelTemp);
  this.stream.write(this.channelTemp);

  // The data itself
  this.stream.write(data);
}

/**
 * Register a collection of handlers to specific events.  While this seems handy, the
 * downside is there is no way to unregister them. 
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



////////////////////////////////////////////////////////////////////////////////////
// Internal / Private things after here ....

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
  var r = this.deque.readBuffer(this.channelTemp);
  if (r!=4)
  {
    throw new Error("Failed to read 4 bytes for PDU payload length");
  }
  this.amtRequired = PK.readUInt32(this.channelTemp);
  L.logi("length is ",this.amtRequired);
  
  if (this.amtRequired < 4)
  {
    // WTF mate?
    L.warni("Got weird payload length",this.amtRequired,". Reading and trying to continue, but probably will go bad soon.")
    this.deque.readBuffer(this.channelTemp, 0, this.amtRequired);
    this.setParseStateGround();
    return;
  }
  
  // First 4 bytes are the channel
  r = this.deque.readBuffer(this.channelTemp);
  if (r!=4)
  {
    throw new Error("Failed to read 4 bytes for PDU payload length");
  }
  this.incomingChannel = PK.readUInt32(this.channelTemp);
  L.logi("Incoming channel is",this.incomingChannel);
  
  // Reduce the amt required
  this.amtRequired -= 4;
  L.logi("Remaining data is",this.amtRequired);
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
    var msg = JSON.parse(data);

    // Allow a preDispatchHook to pre-process or otherwise veto the dispatching
    if (this.preDispatchHook)
    {
      if (!this.preDispatchHook(msg))
      {
        L.debugi("Pre-dispatch hook returned false, skipping dispatch");
        return;
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
  try 
  {    
    data = this.incomingBuffer.slice(0,this.amtRequired);      
    this.emit("c"+this.incomingChannel,data);
  }
  catch(err)
  {
    L.warni("Error during channel",this.incomingChannel,"dispatch",err);
    if (err.stack)
    {
      L.warni(err.stack);
    }
    this.emit("dataException",err);
  }
}

