/**
 * Dependencies
 */ 
var Net = require("net");
var Util = require("util");
var Events = require("events");

var L = require("log");
var PK = require("pk");

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

  this.outgoingQueue = [];
  this.incomingQueue = [];
  this.incomingPartial = "";  
  this.stream = stream;
  
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
  
  // Add this on to whatever we had already
  this.incomingPartial = this.incomingPartial + data;
  
  // Decide if the last element is going to be parsable or not
  var lastChar = this.incomingPartial.charAt(this.incomingPartial.length-1);
  
  // Now split it up for parsing
  var toParse = this.incomingPartial.split("\n");
  this.incomingPartial = "";
  
  for(var i=0; i<toParse.length; i++)
  {
    if ((i === toParse.length - 1) && (lastChar !== "\n"))
    {
      // The last one is not a complete thing, so we're out
      this.incomingPartial = toParse[i];
      break;
    }
    
    if (toParse[i].length == 0) continue;
        
    try 
    {
      var msg = JSON.parse(toParse[i]);

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
 * Write any pending messages from the message queue
 *
 * @type void
 */
Queue.prototype.writeQueuedMessages = function()
{
  for(var i=0; i<this.outgoingQueue.length; i++)
  {
    var msg = this.outgoingQueue[i];
 
    if (this.stream.writable)
    {
      this.stream.write(JSON.stringify(msg));
      this.stream.write("\n");
    }
    else
    {
      L.logi("Stream not writable. Ignoring outgoing msg",msg);
    }
  }

  // Empty it by making a new one
  this.outgoingQueue = [];
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
  this.outgoingQueue.push(msg);
  this.writeQueuedMessages();
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